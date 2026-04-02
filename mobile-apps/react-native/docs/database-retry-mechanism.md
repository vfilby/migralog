# Database Retry Mechanism

This document explains the centralized database retry mechanism implemented in the MigraineTracker app to handle transient SQLite errors automatically.

## Overview

The retry wrapper provides automatic retry logic for SQLite database operations that might fail due to transient errors like database locks, I/O errors, or temporary resource unavailability. This improves the app's reliability without requiring changes to existing repository code.

## Implementation

### Location

- **Main implementation**: `src/database/retryWrapper.ts`
- **Integration point**: `src/database/db.ts`
- **Tests**: `src/database/__tests__/retryWrapper.test.ts`

### Key Components

#### 1. Error Classification

The wrapper distinguishes between retryable and non-retryable errors:

**Retryable Errors** (will be retried):
- `SQLITE_BUSY (5)`: Database is locked by another process/thread
- `SQLITE_LOCKED (6)`: A table in the database is locked  
- `SQLITE_IOERR (10)`: I/O error occurred
- `SQLITE_PROTOCOL (15)`: Database lock protocol error
- `SQLITE_FULL (13)`: Database or disk is full (may be temporary)
- `SQLITE_CANTOPEN (14)`: Unable to open database file

**Non-Retryable Errors** (will fail immediately):
- `SQLITE_ERROR (1)`: SQL error or missing database
- `SQLITE_CONSTRAINT (19)`: Constraint violation (UNIQUE, FOREIGN KEY, etc.)
- `SQLITE_CORRUPT (11)`: Database disk image is malformed
- And other permanent errors...

#### 2. Exponential Backoff

The retry mechanism uses exponential backoff with configurable parameters:

```typescript
{
  maxRetries: 3,           // Maximum number of retry attempts
  initialDelayMs: 100,     // Initial delay before first retry
  maxDelayMs: 800,         // Maximum delay between retries
  backoffMultiplier: 2     // Multiplier for exponential backoff
}
```

**Retry Schedule**:
- 1st retry: 100ms delay
- 2nd retry: 200ms delay  
- 3rd retry: 400ms delay
- After 3 retries: fail with original error

#### 3. Wrapped Methods

The following SQLite database methods are wrapped with retry logic:

- `runAsync()` - For INSERT, UPDATE, DELETE operations
- `getAllAsync()` - For SELECT operations returning multiple rows
- `getFirstAsync()` - For SELECT operations returning single row
- `execAsync()` - For schema operations and batched statements
- `withTransactionAsync()` - For database transactions
- `withExclusiveTransactionAsync()` - For exclusive transactions

#### 4. Logging

The wrapper integrates with existing logging infrastructure:

- **Retry attempts**: Logged via `logger.log()` (development only)
- **Retry failures**: Logged via `errorLogger.log()` (persistent storage)
- **Non-retryable errors**: Logged via `logger.log()` (development only)

## Integration

### Automatic Application

The retry wrapper is automatically applied during database initialization in `src/database/db.ts`:

```typescript
import { createRetryWrapper } from './retryWrapper';

export const getDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
  // ... database initialization logic ...
  
  // Wrap the database with retry logic for transient errors
  const wrappedDb = createRetryWrapper(db);
  logger.log('[DB] Database retry wrapper applied');
  
  return wrappedDb;
};
```

### Transparent Operation

All existing repository code continues to work without changes. For example:

```typescript
// This automatically gets retry logic:
await database.runAsync('INSERT INTO episodes (...) VALUES (?)', [params]);
await database.getAllAsync('SELECT * FROM episodes ORDER BY start_time DESC');
await database.getFirstAsync('SELECT * FROM episodes WHERE id = ?', [id]);
```

The retry wrapper uses a Proxy pattern to intercept method calls and add retry logic transparently.

## Usage Examples

### Basic Database Operations

```typescript
// These operations automatically retry on transient errors:
const db = await getDatabase();

// INSERT with retry on SQLITE_BUSY
await db.runAsync('INSERT INTO test (name) VALUES (?)', ['value']);

// SELECT with retry on SQLITE_LOCKED  
const results = await db.getAllAsync('SELECT * FROM test');

// Single row SELECT with retry on SQLITE_IOERR
const result = await db.getFirstAsync('SELECT * FROM test WHERE id = ?', [1]);
```

### Custom Configuration

You can create a wrapper with custom retry configuration:

```typescript
import { createRetryWrapper } from './retryWrapper';

const customDb = createRetryWrapper(database, {
  maxRetries: 5,           // More retry attempts
  initialDelayMs: 50,      // Faster initial retry
  maxDelayMs: 2000,        // Longer maximum delay
  backoffMultiplier: 1.5   // Gentler exponential growth
});
```

### Error Handling

The wrapper preserves original error types for non-retryable errors:

```typescript
try {
  await db.runAsync('INSERT INTO test (id) VALUES (?)', [1]);
  await db.runAsync('INSERT INTO test (id) VALUES (?)', [1]); // Same ID
} catch (error) {
  // This will be SQLITE_CONSTRAINT error, not retried
  console.error('Constraint violation:', error.message);
}
```

## Monitoring and Debugging

### Log Messages

**Successful retry**:
```
[DatabaseRetry] runAsync(INSERT) succeeded on attempt 2
```

**Retry attempt**:
```
[DatabaseRetry] getAllAsync(SELECT) failed on attempt 1/3, retrying in 100ms: database is locked
```

**Final failure after retries**:
```
[DatabaseRetry] getFirstAsync(SELECT) failed after 3 retries: database is locked
```

**Non-retryable error**:
```
[DatabaseRetry] runAsync(INSERT) failed with non-retryable error: UNIQUE constraint failed
```

### Error Tracking

Retry failures are automatically logged to the persistent error log via `errorLogger.log()` with context:

```typescript
{
  operation: 'runAsync(INSERT)',
  attempts: 4,
  retryable: true
}
```

## Testing

### Unit Tests

Comprehensive tests in `src/database/__tests__/retryWrapper.test.ts`:

- Error classification (retryable vs non-retryable)
- Exponential backoff calculation
- Retry logic for all wrapped methods
- Custom configuration handling
- Mock-based testing of retry behavior

### Integration Tests

Integration tests in `src/database/__tests__/retryWrapper.integration.test.ts`:

- Interface compatibility with existing repositories
- Property preservation through wrapper
- Type safety verification

### Running Tests

```bash
npm run test:ci -- src/database/__tests__/retryWrapper.test.ts
npm run test:ci -- src/database/__tests__/retryWrapper.integration.test.ts
```

## Performance Considerations

### Overhead

- **Successful operations**: Minimal overhead (single function call)
- **Failed operations**: Additional delay only for retryable errors
- **Memory usage**: Negligible increase (proxy wrapper)

### Benefits

- **Improved reliability**: Automatic recovery from transient errors
- **Better user experience**: Fewer database operation failures
- **Reduced error rates**: Especially beneficial on slower devices or under load

## Error Scenarios

### Typical Retry Scenarios

1. **Database lock contention**: Multiple operations accessing same data
2. **I/O errors**: Temporary storage issues on mobile devices
3. **Resource exhaustion**: Brief periods of high system load
4. **Storage full**: Temporary disk space issues

### When Retries Won't Help

1. **SQL syntax errors**: Code bugs that need fixing
2. **Constraint violations**: Data integrity issues  
3. **Corrupted database**: Requires database recovery
4. **Permission errors**: Configuration or security issues

## Future Enhancements

Potential improvements for the retry mechanism:

1. **Configurable per-operation**: Different retry settings for different operations
2. **Circuit breaker**: Stop retrying if failure rate is too high
3. **Metrics collection**: Track retry success rates and patterns
4. **Adaptive backoff**: Adjust delays based on error patterns
5. **Selective method wrapping**: Only wrap specific operations if needed

## Conclusion

The database retry mechanism provides a robust, transparent way to handle transient SQLite errors without impacting existing code. It improves app reliability through intelligent error handling, exponential backoff, and comprehensive logging while maintaining the same interface that repository code expects.