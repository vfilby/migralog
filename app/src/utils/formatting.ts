/**
 * General-purpose formatting utilities
 *
 * These functions provide common formatting operations used throughout the app.
 * Moved from backupUtils.ts to be available for any module that needs formatting.
 */

/**
 * Format file size in human-readable format
 *
 * @param bytes - The size in bytes
 * @returns Human-readable string like "1.5 MB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Format timestamp as locale date string
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Locale-formatted date string
 */
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString();
}
