# Logging Guide

Comprehensive guide to the MigraineTracker enhanced logging system for debugging, monitoring, and troubleshooting.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Using the Logger](#using-the-logger)
- [Log Levels](#log-levels)
- [Viewing Logs on Device](#viewing-logs-on-device)
- [Configuring Log Levels](#configuring-log-levels)
- [Exporting and Sharing Logs](#exporting-and-sharing-logs)
- [Privacy and Security](#privacy-and-security)
- [Best Practices](#best-practices)
- [Performance Considerations](#performance-considerations)
- [Troubleshooting](#troubleshooting)

## Overview

The enhanced logging system provides configurable, persistent logging with structured metadata support. It maintains backward compatibility with the original logger API while adding advanced features for debugging and monitoring.

### Key Features

- **Configurable log levels** (DEBUG, INFO, WARN, ERROR)
- **Persistent storage** - Last 500 logs stored in AsyncStorage
- **Structured logging** - Attach metadata objects to any log
- **Stack trace capture** - Automatic for errors
- **On-device log viewer** - View, filter, and search logs
- **Export functionality** - Share logs for bug reports
- **Privacy-first** - PII scrubbing and HIPAA compliance considerations
- **Development-friendly** - Console logging in dev mode only

## Quick Start

### Basic Logging

```typescript
import { logger } from '../utils/logger';

// Simple messages
logger.log('User logged in');
logger.info('Data synced successfully');
logger.warn('Cache is nearly full');
logger.error('Failed to load data');
```

### Structured Logging with Context

```typescript
import { logger } from '../utils/logger';

// Add context to any log
logger.info('Episode created', {
  episodeId: 123,
  intensity: 7,
  hasMedication: true
});

// Error logging with context
logger.error('API request failed', {
  endpoint: '/api/episodes',
  statusCode: 500,
  retryAttempt: 3
});
```

### Viewing Logs on Device

1. Open **Settings** screen
2. Enable **Developer Mode** (tap app version 7 times)
3. Tap **Developer Tools**
4. Tap **App Logs**

## Architecture

### Components

The logging system consists of three main components:

1. **Logger Service** (`src/utils/logger.ts`) - Core logging implementation
2. **Error Logger** (`src/services/errorLogger.ts`) - Specialized error tracking
3. **Log Viewer UI** (`src/screens/settings/LogViewerScreen.tsx`) - On-device log viewing

### Data Flow

```
Application Code
       ↓
   logger.info()
       ↓
   Logger Class
       ↓
  ┌────┴────┐
  ↓         ↓
AsyncStorage  Console (dev only)
```

### Storage

- **Location**: AsyncStorage keys `@app_logs` and `@log_level`
- **Capacity**: Last 500 log entries (FIFO)
- **Persistence**: Survives app restarts
- **Format**: JSON with timestamps as ISO strings

## Using the Logger

### Import

```typescript
import { logger, LogLevel } from '../utils/logger';
```

### Basic Methods

#### `logger.log()` / `logger.info()`

Log informational messages. Both are aliases for `LogLevel.INFO`.

```typescript
logger.log('User completed onboarding');
logger.info('Database migration complete');
```

#### `logger.debug()`

Log debug information. Only visible when log level is DEBUG.

```typescript
logger.debug('Computed value:', computedValue);
logger.debug('Function called with args', { arg1, arg2 });
```

#### `logger.warn()`

Log warnings that don't prevent operation but indicate potential issues.

```typescript
logger.warn('Low storage space remaining', {
  bytesAvailable: 1024000,
  threshold: 5000000
});
```

#### `logger.error()`

Log errors and exceptions. Automatically captures stack traces.

```typescript
try {
  await riskyOperation();
} catch (error) {
  logger.error(error); // Captures error message and stack
}

// Or with additional context
logger.error('Database operation failed', {
  operation: 'insert',
  table: 'episodes',
  error: error.message
});
```

### Advanced Usage

#### Structured Logging

Attach metadata to provide context:

```typescript
logger.info('User action', {
  action: 'episode_created',
  userId: user.id,
  episodeId: episode.id,
  timestamp: new Date().toISOString()
});
```

#### Async Operations

The logger methods are fire-and-forget for performance. For async operations where you need to ensure logging completes:

```typescript
import { logger } from '../utils/logger';

// Standard usage (fire-and-forget)
logger.info('Operation started');

// Wait for log to persist
await logger.logInternal(LogLevel.INFO, 'Critical operation', {
  important: true
});
```

#### Getting Logs Programmatically

```typescript
// Synchronous (from memory buffer)
const logs = logger.getLogs();

// Asynchronous (ensures initialization)
const logs = await logger.getLogsAsync();
```

#### Clearing Logs

```typescript
// Synchronous
logger.clearLogs();

// Asynchronous (ensures initialization)
await logger.clearLogsAsync();
```

## Log Levels

Log levels control both what gets logged and what gets displayed. Lower values are more verbose.

| Level | Value | Usage | Example |
|-------|-------|-------|---------|
| **DEBUG** | 0 | Detailed diagnostic information | Variable values, function entry/exit |
| **INFO** | 1 | General informational messages | User actions, successful operations |
| **WARN** | 2 | Warning messages | Deprecated API usage, low resources |
| **ERROR** | 3 | Error messages | Exceptions, failed operations |

### Default Levels

- **Development** (`__DEV__ = true`): `DEBUG`
- **Production** (`__DEV__ = false`): `ERROR`

### When to Use Each Level

#### DEBUG

Use for detailed diagnostic information:

```typescript
logger.debug('Entering function', { params: { id, name } });
logger.debug('Loop iteration', { index: i, value: arr[i] });
logger.debug('Cache miss', { key: cacheKey });
```

#### INFO

Use for significant events:

```typescript
logger.info('User logged in', { userId: user.id });
logger.info('Episode created', { episodeId: ep.id });
logger.info('Backup completed', { episodeCount: 42 });
```

#### WARN

Use for potential issues:

```typescript
logger.warn('API rate limit approaching', { requests: 95, limit: 100 });
logger.warn('Old app version detected', { current: '1.2.0', latest: '1.5.0' });
logger.warn('Cache eviction triggered', { reason: 'memory_pressure' });
```

#### ERROR

Use for failures and exceptions:

```typescript
logger.error('Failed to save episode', { error: err.message });
logger.error('Database connection lost', { retries: 3 });
logger.error(error); // Auto-captures stack trace
```

## Viewing Logs on Device

### Accessing the Log Viewer

1. Open the **Settings** screen
2. Scroll to **About** section
3. Tap the **app version** 7 times to enable Developer Mode
4. Tap **Developer Tools** (now visible)
5. Tap **App Logs**

### Log Viewer Features

#### Filtering

- **Level Filters**: ALL, DEBUG, INFO, WARN, ERROR
- **Search**: Filter by message content, level, or stack trace
- **Badge Counts**: Shows number of logs per level

#### Viewing Details

- Tap any log entry to expand and view:
  - **Context**: Structured metadata object
  - **Stack Trace**: Full stack trace for errors

#### Refreshing

- Pull down to refresh log list

#### Export/Clear

- **Export** (share icon): Share logs via native share sheet
- **Clear** (trash icon): Delete all logs with confirmation

### Log Entry Format

Each log entry displays:

```
[LEVEL] HH:MM:SS.mmm
Message text

Context: { ... }      (if present)
Stack Trace: ...      (if present)
```

## Configuring Log Levels

### Via Code

```typescript
import { logger, LogLevel } from '../utils/logger';

// Set log level
await logger.setLogLevel(LogLevel.DEBUG);

// Get current log level
const level = await logger.getLogLevel();
console.log(`Current level: ${LogLevel[level]}`);
```

### Via Developer Tools UI

1. Navigate to **Developer Tools** screen
2. Find **Log Level** section
3. Tap buttons to change level (DEBUG, INFO, WARN, ERROR)
4. Setting persists across app restarts

### Effect on Logging

When you set a log level, only logs at that level or higher are recorded:

```typescript
await logger.setLogLevel(LogLevel.WARN);

logger.debug('Not logged');  // Filtered out
logger.info('Not logged');   // Filtered out
logger.warn('Logged');       // ✓ Logged
logger.error('Logged');      // ✓ Logged
```

## Exporting and Sharing Logs

### From Log Viewer Screen

1. Navigate to **App Logs**
2. Tap the **share icon** (top right)
3. Choose sharing method (email, Files, etc.)

### Programmatically

```typescript
import { logger } from '../utils/logger';

// Get logs as JSON string
const logsJson = logger.exportLogs();

// Share via native sheet
await logger.shareLogs();
```

### Export Format

Logs are exported as JSON with the following structure:

```json
{
  "exportedAt": "2025-12-07T10:30:00.000Z",
  "currentLogLevel": "INFO",
  "totalLogs": 42,
  "logs": [
    {
      "id": "1638876600000-abc123",
      "timestamp": "2025-12-07T10:25:00.000Z",
      "level": "ERROR",
      "message": "Failed to save episode",
      "context": {
        "episodeId": 123,
        "error": "Network timeout"
      },
      "stack": "Error: Network timeout\n    at ..."
    }
  ]
}
```

## Privacy and Security

### HIPAA Compliance

The logging system is designed with healthcare data privacy in mind:

- **No automatic PII logging** - The logger never automatically logs health data
- **Local storage only** - Logs stored on device, not transmitted
- **Developer control** - You choose what to log

### What NOT to Log

Never log personally identifiable information (PII) or protected health information (PHI):

```typescript
// ❌ BAD - Logs PHI
logger.info('Episode created', {
  patientName: 'John Doe',          // PHI
  symptoms: ['headache', 'nausea'],  // PHI
  location: gpsCoordinates           // PII
});

// ✓ GOOD - Logs only IDs and metadata
logger.info('Episode created', {
  episodeId: episode.id,
  symptomCount: symptoms.length,
  hasLocation: !!location
});
```

### Safe Logging Practices

```typescript
// Use IDs instead of names
logger.info('Medication taken', { medicationId: med.id });

// Log counts instead of data
logger.info('Episodes synced', { count: episodes.length });

// Log boolean flags instead of values
logger.info('User profile updated', {
  hasEmail: !!user.email,
  hasPhone: !!user.phone
});

// Sanitize error messages
try {
  await operation();
} catch (error) {
  logger.error('Operation failed', {
    type: error.name,
    // Don't include error.message if it might contain PHI
  });
}
```

### Export Warnings

When sharing logs for bug reports:

1. **Review before sharing** - Check exported logs for PHI/PII
2. **Use secure channels** - Share via encrypted email or secure file transfer
3. **Clear after sharing** - Delete logs from device after debugging

## Best Practices

### Do's

✓ **Use appropriate log levels**
```typescript
logger.debug('Cache lookup', { key });
logger.info('User action completed');
logger.warn('Resource limit approaching');
logger.error('Operation failed', { error });
```

✓ **Include context for debugging**
```typescript
logger.error('API request failed', {
  endpoint: '/api/episodes',
  statusCode: response.status,
  retryCount: retries
});
```

✓ **Log state transitions**
```typescript
logger.info('Episode state changed', {
  episodeId: id,
  from: 'active',
  to: 'completed'
});
```

✓ **Use structured logging**
```typescript
logger.info('Database migration', {
  version: newVersion,
  duration: endTime - startTime,
  recordsAffected: count
});
```

### Don'ts

❌ **Don't log in tight loops**
```typescript
// BAD - Creates too many logs
for (let i = 0; i < 10000; i++) {
  logger.debug('Processing item', { index: i });
}

// GOOD - Log summary
logger.debug('Processing batch', { count: items.length });
```

❌ **Don't log sensitive data**
```typescript
// BAD
logger.info('User data', { password: user.password });

// GOOD
logger.info('User authenticated', { userId: user.id });
```

❌ **Don't use logs for flow control**
```typescript
// BAD
try {
  await operation();
} catch (error) {
  logger.error(error);
  return; // Using log as flag
}

// GOOD
try {
  await operation();
} catch (error) {
  logger.error('Operation failed', { error: error.message });
  throw error; // Proper error handling
}
```

❌ **Don't concatenate strings**
```typescript
// BAD
logger.info('User ' + user.id + ' created episode ' + episode.id);

// GOOD
logger.info('User created episode', {
  userId: user.id,
  episodeId: episode.id
});
```

### Logging Patterns

#### Service Methods

```typescript
class EpisodeService {
  async createEpisode(data: EpisodeData) {
    logger.debug('Creating episode', { data });
    
    try {
      const episode = await episodeRepository.create(data);
      logger.info('Episode created', { episodeId: episode.id });
      return episode;
    } catch (error) {
      logger.error('Failed to create episode', {
        error: error.message,
        data
      });
      throw error;
    }
  }
}
```

#### API Calls

```typescript
async function fetchData(endpoint: string) {
  logger.debug('API request', { endpoint });
  
  try {
    const response = await fetch(endpoint);
    logger.info('API response', {
      endpoint,
      status: response.status,
      duration: response.headers.get('x-response-time')
    });
    return response.json();
  } catch (error) {
    logger.error('API request failed', {
      endpoint,
      error: error.message
    });
    throw error;
  }
}
```

#### State Updates

```typescript
// In Zustand store
setState((state) => {
  logger.debug('Store update', {
    store: 'episode',
    action: 'addEpisode',
    currentCount: state.episodes.length
  });
  
  return {
    episodes: [...state.episodes, newEpisode]
  };
});
```

## Performance Considerations

### Memory Management

- **Buffer size**: 500 log limit prevents memory bloat
- **FIFO eviction**: Oldest logs removed when limit reached
- **Efficient storage**: Logs serialized only on persistence

### AsyncStorage Impact

- **Fire-and-forget**: Logging doesn't block UI thread
- **Batch writes**: Logs batched to AsyncStorage
- **Failed writes**: Logged to console but don't throw errors

### Console Logging

```typescript
// Development: Logs to console AND AsyncStorage
// Production: Logs ONLY to AsyncStorage (no console)

if (__DEV__) {
  console.log('[INFO]', message, context); // Only in dev
}
await AsyncStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(logs)); // Always
```

### Optimization Tips

```typescript
// ✓ GOOD - Minimal overhead
logger.info('Operation complete', { id, count });

// ❌ BAD - Heavy computation
logger.debug('Data dump', {
  largeObject: JSON.parse(JSON.stringify(hugeObject)) // Expensive
});

// ✓ GOOD - Defer expensive operations
if (await logger.getLogLevel() === LogLevel.DEBUG) {
  logger.debug('Data dump', { serialized: expensiveOperation() });
}
```

## Troubleshooting

### Logs Not Appearing

**Problem**: Logs don't show in Log Viewer

**Solutions**:

1. Check log level setting:
   ```typescript
   const level = await logger.getLogLevel();
   console.log('Current level:', LogLevel[level]);
   ```

2. Ensure log level is appropriate:
   ```typescript
   // If level is ERROR, only errors show
   await logger.setLogLevel(LogLevel.DEBUG); // Show all logs
   ```

3. Refresh the Log Viewer:
   - Pull down to refresh
   - Navigate away and back

4. Check AsyncStorage:
   ```typescript
   import AsyncStorage from '@react-native-async-storage/async-storage';
   const logs = await AsyncStorage.getItem('@app_logs');
   console.log('Stored logs:', logs);
   ```

### Logs Cleared Unexpectedly

**Problem**: Logs disappear after app restart

**Cause**: AsyncStorage cleared or app data deleted

**Prevention**:
- Export logs before debugging
- Don't clear app data unless necessary

### Export Not Working

**Problem**: Share sheet doesn't appear

**Solutions**:

1. Check permissions (shouldn't be needed for Share API)
2. Try manual export:
   ```typescript
   const logs = logger.exportLogs();
   console.log(logs); // Copy from dev tools
   ```

3. Check for errors:
   ```typescript
   try {
     await logger.shareLogs();
   } catch (error) {
     console.error('Share failed:', error);
   }
   ```

### Too Many Logs

**Problem**: Log viewer is slow or unresponsive

**Solutions**:

1. Increase log level to reduce volume:
   ```typescript
   await logger.setLogLevel(LogLevel.ERROR);
   ```

2. Clear old logs:
   ```typescript
   logger.clearLogs();
   ```

3. Use filters in Log Viewer:
   - Select specific level (ERROR only)
   - Use search to narrow results

### Missing Stack Traces

**Problem**: Error logs don't show stack traces

**Cause**: Stack trace only captured for Error objects

**Solution**:
```typescript
// ❌ Won't capture stack
logger.error('Something failed');

// ✓ Captures stack
logger.error(new Error('Something failed'));

// ✓ Also captures stack
try {
  throw new Error('Something failed');
} catch (error) {
  logger.error(error);
}
```

## Examples

### Complete Example: Database Migration

```typescript
// src/database/migrations.ts
import { logger, LogLevel } from '../utils/logger';

async function runMigration(db: SQLiteDatabase, version: number) {
  const startTime = Date.now();
  
  logger.info('Migration started', {
    targetVersion: version,
    currentVersion: await getCurrentVersion(db)
  });
  
  try {
    // Create backup
    logger.debug('Creating backup before migration');
    await createBackup(db);
    
    // Run migration
    await db.execAsync(migrationSQL[version]);
    
    const duration = Date.now() - startTime;
    logger.info('Migration completed', {
      version,
      duration,
      success: true
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Migration failed', {
      version,
      duration,
      error: error.message,
      rollbackRequired: true
    });
    
    // Attempt rollback
    try {
      await restoreBackup(db);
      logger.info('Rollback successful', { version });
    } catch (rollbackError) {
      logger.error('Rollback failed', {
        version,
        originalError: error.message,
        rollbackError: rollbackError.message
      });
    }
    
    throw error;
  }
}
```

### Complete Example: API Service

```typescript
// src/services/apiService.ts
import { logger } from '../utils/logger';

class APIService {
  async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const requestId = `${Date.now()}-${Math.random()}`;
    
    logger.debug('API request initiated', {
      requestId,
      endpoint,
      method: options?.method || 'GET'
    });
    
    const startTime = Date.now();
    
    try {
      const response = await fetch(endpoint, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });
      
      const duration = Date.now() - startTime;
      
      if (!response.ok) {
        logger.warn('API request returned error status', {
          requestId,
          endpoint,
          status: response.status,
          statusText: response.statusText,
          duration
        });
      } else {
        logger.info('API request successful', {
          requestId,
          endpoint,
          status: response.status,
          duration
        });
      }
      
      const data = await response.json();
      return data as T;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('API request failed', {
        requestId,
        endpoint,
        error: error.message,
        duration,
        networkError: error instanceof TypeError
      });
      
      throw error;
    }
  }
}
```

## See Also

- [Error Handling Patterns](error-handling-patterns.md) - Error handling best practices
- [Sentry Setup](sentry-setup.md) - Production error monitoring
- [Testing Guide](../TESTING.md) - Testing strategies including log assertions
- [Developer Tools](../../docs/wiki/Features.md#developer-tools) - Overview of developer features

## Reference

### Logger API

For complete API reference, see [`src/utils/logger.ts`](../src/utils/logger.ts:1).

#### Methods

- `logger.debug(...args)` - Log debug messages (LogLevel.DEBUG)
- `logger.log(...args)` - Log general messages (alias for info)
- `logger.info(message, context?)` - Log informational messages (LogLevel.INFO)
- `logger.warn(message, context?)` - Log warnings (LogLevel.WARN)
- `logger.error(errorOrMessage, context?)` - Log errors (LogLevel.ERROR)
- `logger.getLogLevel(): Promise<LogLevel>` - Get current log level
- `logger.setLogLevel(level): Promise<void>` - Set log level
- `logger.getLogs(): LogEntry[]` - Get all logs (sync)
- `logger.getLogsAsync(): Promise<LogEntry[]>` - Get all logs (async)
- `logger.clearLogs(): void` - Clear all logs (sync)
- `logger.clearLogsAsync(): Promise<void>` - Clear all logs (async)
- `logger.exportLogs(): string` - Export logs as JSON (sync)
- `logger.exportLogsAsync(): Promise<string>` - Export logs as JSON (async)
- `logger.shareLogs(): Promise<void>` - Share logs via native sheet

#### Types

```typescript
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  stack?: string;
}
```
