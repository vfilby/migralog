import { logger } from '../utils/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ErrorLog {
  id: string;
  timestamp: number;
  type: 'database' | 'network' | 'storage' | 'general';
  message: string;
  stack?: string;
  context?: Record<string, any>;
}

const MAX_LOGS = 100;
const STORAGE_KEY = '@error_logs';

class ErrorLogger {
  private logs: ErrorLog[] = [];
  private initialized = false;

  async init() {
    if (this.initialized) return;

    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.logs = JSON.parse(stored);
      }
      this.initialized = true;
    } catch (error) {
      logger.error('Failed to load error logs:', error);
    }
  }

  async log(
    type: ErrorLog['type'],
    message: string,
    error?: Error,
    context?: Record<string, any>
  ): Promise<void> {
    const errorLog: ErrorLog = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      type,
      message,
      stack: error?.stack,
      context,
    };

    // Add to beginning of array
    this.logs.unshift(errorLog);

    // Trim to max size
    if (this.logs.length > MAX_LOGS) {
      this.logs = this.logs.slice(0, MAX_LOGS);
    }

    // Log to console in development
    logger.error(`[${type}] ${message}`, error, context);

    // Persist to storage
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.logs));
    } catch (storageError) {
      logger.error('Failed to persist error logs:', storageError);
    }
  }

  async getLogs(): Promise<ErrorLog[]> {
    await this.init();
    return this.logs;
  }

  async clearLogs(): Promise<void> {
    this.logs = [];
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      logger.error('Failed to clear error logs:', error);
    }
  }

  async getRecentLogs(count: number = 10): Promise<ErrorLog[]> {
    await this.init();
    return this.logs.slice(0, count);
  }

  async getLogsByType(type: ErrorLog['type']): Promise<ErrorLog[]> {
    await this.init();
    return this.logs.filter(log => log.type === type);
  }
}

export const errorLogger = new ErrorLogger();
