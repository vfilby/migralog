import type { ErrorEvent, TransactionEvent, Breadcrumb } from '@sentry/react-native';
import type { EventHint } from '@sentry/core';

/**
 * Scrubs sensitive health data from Sentry events before sending.
 *
 * This is critical for HIPAA compliance - we must never send PHI/PII to Sentry.
 *
 * Sensitive fields include:
 * - Medication names and details
 * - Symptom descriptions
 * - Episode details (intensity, pain locations)
 * - User notes and free-text fields
 * - Location data
 * - Any personally identifiable information
 */

const SENSITIVE_KEYS = [
  // Medication fields
  'medication',
  'medicationName',
  'medication_name',
  'dose',
  'dosage',
  'units',

  // Episode fields
  'intensity',
  'pain_location',
  'painLocation',
  'symptom',
  'symptoms',
  'trigger',
  'triggers',

  // User data
  'notes',
  'description',
  'comment',
  'title',

  // Location data
  'latitude',
  'longitude',
  'location',
  'address',

  // Personal info
  'email',
  'phone',
  'name',
  'username',
  'userId',
  'user_id',
];

/**
 * Recursively scrubs sensitive data from an object
 */
function scrubObject(obj: unknown, depth = 0): unknown {
  // Prevent infinite recursion
  if (depth > 10) return '[Max Depth Reached]';

  if (obj === null || obj === undefined) return obj;

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => scrubObject(item, depth + 1));
  }

  // Handle objects
  if (typeof obj === 'object') {
    const scrubbed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();

      // Check if this is a sensitive key
      const isSensitive = SENSITIVE_KEYS.some(sensitiveKey =>
        lowerKey.includes(sensitiveKey.toLowerCase())
      );

      if (isSensitive) {
        scrubbed[key] = '[Redacted]';
      } else {
        scrubbed[key] = scrubObject(value, depth + 1);
      }
    }
    return scrubbed;
  }

  // Return primitives as-is
  return obj;
}

/**
 * Scrubs URLs that might contain sensitive query parameters
 */
function scrubUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // Remove all query parameters as they might contain sensitive data
    urlObj.search = '';
    return urlObj.toString();
  } catch {
    // If URL parsing fails, redact the whole thing
    return '[Redacted URL]';
  }
}

/**
 * Scrubs sensitive data from breadcrumbs
 */
function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  if (!breadcrumb) return breadcrumb;

  const scrubbed = { ...breadcrumb };

  // Scrub URL in navigation breadcrumbs
  if (scrubbed.data && typeof scrubbed.data === 'object' && 'url' in scrubbed.data) {
    const url = (scrubbed.data as Record<string, unknown>).url;
    if (typeof url === 'string') {
      (scrubbed.data as Record<string, unknown>).url = scrubUrl(url);
    }
  }

  // Scrub message if it contains sensitive patterns
  if (scrubbed.message && typeof scrubbed.message === 'string') {
    // Redact anything that looks like it could be sensitive
    scrubbed.message = scrubbed.message
      .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[Phone Redacted]') // Phone numbers
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[Email Redacted]'); // Emails
  }

  // Scrub data object
  if (scrubbed.data) {
    scrubbed.data = scrubObject(scrubbed.data) as Record<string, unknown>;
  }

  return scrubbed;
}

/**
 * Main function to scrub Sentry error events before sending
 */
export function beforeSend(event: ErrorEvent, _hint: EventHint): ErrorEvent | null {
  try {
    // Scrub request data
    if (event.request) {
      if (event.request.url) {
        event.request.url = scrubUrl(event.request.url);
      }
      if (event.request.query_string) {
        event.request.query_string = '[Redacted]';
      }
      if (event.request.data) {
        event.request.data = scrubObject(event.request.data);
      }
      if (event.request.headers) {
        event.request.headers = scrubObject(event.request.headers) as typeof event.request.headers;
      }
    }

    // Scrub breadcrumbs
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map(scrubBreadcrumb);
    }

    // Scrub contexts
    if (event.contexts) {
      event.contexts = scrubObject(event.contexts) as typeof event.contexts;
    }

    // Scrub extra data
    if (event.extra) {
      event.extra = scrubObject(event.extra) as typeof event.extra;
    }

    // Scrub user data
    if (event.user) {
      // Keep device-level data but remove anything personal
      event.user = {
        id: event.user.id ? '[User ID Redacted]' : undefined,
        ip_address: undefined,
        email: undefined,
        username: undefined,
      };
    }

    // Scrub exception values
    if (event.exception?.values) {
      event.exception.values = event.exception.values.map(exception => ({
        ...exception,
        value: exception.value, // Keep error messages as they're usually not sensitive
        stacktrace: exception.stacktrace, // Keep stack traces for debugging
      }));
    }

    return event;
  } catch (error) {
    // If scrubbing fails, don't send the event to be safe
    // eslint-disable-next-line no-console
    console.error('Error scrubbing Sentry event:', error);
    return null;
  }
}

/**
 * Scrub transaction events before sending
 */
export function beforeSendTransaction(event: TransactionEvent, _hint: EventHint): TransactionEvent | null {
  try {
    // Scrub breadcrumbs
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map(scrubBreadcrumb);
    }

    // Scrub contexts
    if (event.contexts) {
      event.contexts = scrubObject(event.contexts) as typeof event.contexts;
    }

    // Scrub extra data
    if (event.extra) {
      event.extra = scrubObject(event.extra) as typeof event.extra;
    }

    return event;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error scrubbing Sentry transaction:', error);
    return null;
  }
}
