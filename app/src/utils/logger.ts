/**
 * Enhanced Logger System
 *
 * Provides configurable logging with levels, persistence, and structured metadata.
 * Maintains backward compatibility with the original logger API while adding
 * advanced features like AsyncStorage persistence and log level management.
 *
 * Features:
 * - Configurable log levels (DEBUG, INFO, WARN, ERROR)
 * - Persists last 500 logs to AsyncStorage
 * - Structured logging with metadata objects
 * - Stack trace capture for errors
 * - Log export functionality
 * - Backward compatible with existing logger.log(), logger.warn(), etc.
 * - Always writes to AsyncStorage, only console.log in dev mode
 *
 * Usage:
 *   import { logger } from '../utils/logger';
 *   
 *   // Basic usage (backward compatible)
 *   logger.log('Debug message');
 *   logger.warn('Warning message');
 *   logger.error('Error message');
 *   
 *   // Advanced usage with metadata
 *   logger.info('User action', { userId: 123, action: 'login' });
 *   logger.error('API error', { endpoint: '/api/data', statusCode: 500 });
 *   
 *   // Configuration
 *   await logger.setLogLevel(LogLevel.INFO);
 *   const logs = logger.getLogs();
 *   logger.clearLogs();
 *   const exportedLogs = logger.exportLogs();
 */

/* eslint-disable no-console */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Share } from 'react-native';
import * as Sentry from '@sentry/react-native';

const STORAGE_KEY_LOGS = '@app_logs';
const STORAGE_KEY_LOG_LEVEL = '@log_level';
const MAX_LOGS = 500;

/**
 * Log severity levels
 * Lower values = more verbose
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * Structure for a single log entry
 */
export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  stack?: string;
}

/**
 * Internal state for the logger
 */
class Logger {
  private currentLevel: LogLevel;
  private logBuffer: LogEntry[] = [];
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    // Set default log level to ERROR for all environments
    // Users can change this via Developer Tools screen
    this.currentLevel = LogLevel.ERROR;
  }

  /**
   * Initialize the logger by loading persisted state
   * This is called automatically on first use
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        // Load persisted log level
        const storedLevel = await AsyncStorage.getItem(STORAGE_KEY_LOG_LEVEL);
        if (storedLevel !== null) {
          const level = parseInt(storedLevel, 10);
          if (level >= LogLevel.DEBUG && level <= LogLevel.ERROR) {
            this.currentLevel = level;
          }
        }

        // Load persisted logs
        const storedLogs = await AsyncStorage.getItem(STORAGE_KEY_LOGS);
        if (storedLogs) {
          const parsed = JSON.parse(storedLogs);
          // Convert timestamp strings back to Date objects
          this.logBuffer = parsed.map((entry: LogEntry) => ({
            ...entry,
            timestamp: new Date(entry.timestamp),
          }));
        }

        this.initialized = true;
        this.initPromise = null;
      } catch (error) {
        console.error('[Logger] Failed to initialize:', error);
        this.initialized = true;
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  /**
   * Ensure logger is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Persist logs to AsyncStorage
   */
  private async persistLogs(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(this.logBuffer));
    } catch (error) {
      console.error('[Logger] Failed to persist logs:', error);
    }
  }

  /**
   * Add a log entry
   */
  private async logInternal(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    stack?: string
  ): Promise<void> {
    // Ensure initialized before logging
    await this.ensureInitialized();

    // Check if this log level should be recorded
    if (level < this.currentLevel) {
      return;
    }

    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      level,
      message,
      context,
      stack,
    };

    // Add to buffer (newest first)
    this.logBuffer.unshift(entry);

    // Keep only MAX_LOGS entries
    if (this.logBuffer.length > MAX_LOGS) {
      this.logBuffer = this.logBuffer.slice(0, MAX_LOGS);
    }

    // Persist to AsyncStorage (fire and forget)
    this.persistLogs().catch(err =>
      console.error('[Logger] Failed to persist log entry:', err)
    );

    // Console log only in development
    if (__DEV__) {
      const levelName = LogLevel[level];
      const prefix = `[${levelName}]`;
      const logFn = level === LogLevel.ERROR ? console.error :
                    level === LogLevel.WARN ? console.warn :
                    console.log;
      
      if (context || stack) {
        logFn(prefix, message, { context, stack });
      } else {
        logFn(prefix, message);
      }
    }
  }

  /**
   * Get current log level
   */
  async getLogLevel(): Promise<LogLevel> {
    await this.ensureInitialized();
    return this.currentLevel;
  }

  /**
   * Set log level
   */
  async setLogLevel(level: LogLevel): Promise<void> {
    await this.ensureInitialized();
    
    this.currentLevel = level;
    
    try {
      await AsyncStorage.setItem(STORAGE_KEY_LOG_LEVEL, level.toString());
    } catch (error) {
      console.error('[Logger] Failed to persist log level:', error);
    }
  }

  /**
   * Get all persisted log entries (synchronous for backward compatibility)
   * Returns logs from memory buffer. Use getLogsAsync() to ensure initialization.
   */
  getLogs(): LogEntry[] {
    return [...this.logBuffer];
  }

  /**
   * Get all persisted log entries (async version)
   * Ensures logger is initialized before returning logs
   * 
   * @returns Array of log entries, newest first
   */
  async getLogsAsync(): Promise<LogEntry[]> {
    await this.ensureInitialized();
    return [...this.logBuffer];
  }

  /**
   * Clear all persisted logs (synchronous for backward compatibility)
   */
  clearLogs(): void {
    this.logBuffer = [];
    
    // Persist removal asynchronously (fire and forget)
    AsyncStorage.removeItem(STORAGE_KEY_LOGS).catch(error => {
      console.error('[Logger] Failed to clear logs:', error);
    });
  }

  /**
   * Clear all persisted logs (async version)
   */
  async clearLogsAsync(): Promise<void> {
    await this.ensureInitialized();
    
    this.logBuffer = [];
    
    try {
      await AsyncStorage.removeItem(STORAGE_KEY_LOGS);
    } catch (error) {
      console.error('[Logger] Failed to clear logs:', error);
    }
  }

  /**
   * Export logs as a formatted string (synchronous for backward compatibility)
   * Useful for sharing logs or debugging
   * 
   * @returns Formatted log string
   */
  exportLogs(): string {
    const exportData = {
      exportedAt: new Date().toISOString(),
      currentLogLevel: LogLevel[this.currentLevel],
      totalLogs: this.logBuffer.length,
      logs: this.logBuffer.map(entry => {
        const timestamp = entry.timestamp instanceof Date 
          ? entry.timestamp.toISOString()
          : new Date(entry.timestamp).toISOString();
        const level = LogLevel[entry.level];
        
        return {
          id: entry.id,
          timestamp,
          level,
          message: entry.message,
          context: entry.context,
          stack: entry.stack,
        };
      }),
    };
    
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Export logs as a formatted string (async version)
   * Ensures logger is initialized before exporting
   * 
   * @returns Formatted log string
   */
  async exportLogsAsync(): Promise<string> {
    await this.ensureInitialized();
    return this.exportLogs();
  }

  /**
   * Share logs via native share sheet
   */
  async shareLogs(): Promise<void> {
    try {
      const logsJson = this.exportLogs();
      await Share.share({
        message: logsJson,
        title: 'App Logs Export',
      });
    } catch (error) {
      console.error('[Logger] Error sharing logs:', error);
    }
  }

  // ============================================================================
  // Backward Compatible API
  // These methods maintain compatibility with the existing logger interface
  // ============================================================================

  /**
   * Log debug messages
   * Maps to LogLevel.DEBUG
   */
  debug(...args: unknown[]): void {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    
    // Fire and forget - don't wait for async operations
    this.logInternal(LogLevel.DEBUG, message).catch(err => 
      console.error('[Logger] Failed to log debug message:', err)
    );
  }

  /**
   * Log informational messages
   * Maps to LogLevel.INFO
   * 
   * Can be called with message only, or message + context object
   */
  info(...args: unknown[]): void {
    if (args.length === 0) return;
    
    const firstArg = args[0];
    const message = typeof firstArg === 'string' ? firstArg : JSON.stringify(firstArg);
    const context = args.length > 1 && typeof args[1] === 'object' && args[1] !== null
      ? args[1] as Record<string, unknown>
      : undefined;
    
    // Fire and forget
    this.logInternal(LogLevel.INFO, message, context).catch(err =>
      console.error('[Logger] Failed to log info message:', err)
    );
  }

  /**
   * Log general messages
   * Alias for info() - maps to LogLevel.INFO
   */
  log(...args: unknown[]): void {
    this.info(...args);
  }

  /**
   * Log warning messages
   * Maps to LogLevel.WARN
   * Sends warnings to Sentry (as exceptions for Error objects, messages otherwise)
   */
  warn(...args: unknown[]): void {
    if (args.length === 0) return;
    
    const firstArg = args[0];
    let message: string;
    let context: Record<string, unknown> | undefined;
    
    // Handle Error objects specially to preserve stack traces
    if (firstArg instanceof Error) {
      message = firstArg.message;
      context = { errorName: firstArg.name };
      
      // If there's a second argument, merge it into context
      if (args.length > 1 && typeof args[1] === 'object' && args[1] !== null) {
        context = { ...context, ...(args[1] as Record<string, unknown>) };
      }
      
      // Send Error objects to Sentry as exceptions to preserve stack traces
      // Sentry's beforeSend hook handles privacy scrubbing automatically
      try {
        Sentry.captureException(firstArg, {
          level: 'warning',
          contexts: context ? { logger: context } : undefined,
        });
      } catch (sentryError) {
        // Don't let Sentry errors break logging
        console.error('[Logger] Failed to send warning to Sentry:', sentryError);
      }
    } else {
      message = typeof firstArg === 'string' ? firstArg : JSON.stringify(firstArg);
      context = args.length > 1 && typeof args[1] === 'object' && args[1] !== null
        ? args[1] as Record<string, unknown>
        : undefined;
      
      // Send non-Error warnings to Sentry as messages
      // Sentry's beforeSend hook handles privacy scrubbing automatically
      try {
        Sentry.captureMessage(message, {
          level: 'warning',
          contexts: context ? { logger: context } : undefined,
        });
      } catch (sentryError) {
        // Don't let Sentry errors break logging
        console.error('[Logger] Failed to send warning to Sentry:', sentryError);
      }
    }
    
    // Fire and forget for local logging
    this.logInternal(LogLevel.WARN, message, context).catch(err =>
      console.error('[Logger] Failed to log warn message:', err)
    );
  }

  /**
   * Log error messages
   * Maps to LogLevel.ERROR
   * 
   * Automatically captures stack trace from Error objects
   * Sends errors to Sentry for remote monitoring
   */
  error(...args: unknown[]): void {
    if (args.length === 0) return;
    
    let message: string;
    let context: Record<string, unknown> | undefined;
    let stack: string | undefined;
    let errorForSentry: Error;
    
    const firstArg = args[0];
    
    // Handle Error objects specially
    if (firstArg instanceof Error) {
      message = firstArg.message;
      stack = firstArg.stack;
      context = { errorName: firstArg.name };
      errorForSentry = firstArg;
      
      // If there's a second argument, merge it into context
      if (args.length > 1 && typeof args[1] === 'object' && args[1] !== null) {
        context = { ...context, ...(args[1] as Record<string, unknown>) };
      }
    } else {
      message = typeof firstArg === 'string' ? firstArg : JSON.stringify(firstArg);
      context = args.length > 1 && typeof args[1] === 'object' && args[1] !== null
        ? args[1] as Record<string, unknown>
        : undefined;
      errorForSentry = new Error(message);
    }
    
    // Send to Sentry with context
    // Sentry's beforeSend hook handles privacy scrubbing automatically
    try {
      Sentry.captureException(errorForSentry, {
        contexts: context ? { logger: context } : undefined,
      });
    } catch (sentryError) {
      // Don't let Sentry errors break logging
      console.error('[Logger] Failed to send error to Sentry:', sentryError);
    }
    
    // Fire and forget for local logging
    this.logInternal(LogLevel.ERROR, message, context, stack).catch(err =>
      console.error('[Logger] Failed to log error message:', err)
    );
  }
}

/**
 * Singleton logger instance
 */
export const logger = new Logger();
