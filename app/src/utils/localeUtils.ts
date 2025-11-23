/**
 * Locale utilities for date/time formatting
 *
 * Provides device locale detection and date-fns locale mapping for
 * locale-aware date/time formatting throughout the app.
 */

import { enUS, enGB, enAU, enCA, de, fr, es, it, ja, ko, zhCN, pt, nl } from 'date-fns/locale';
import type { Locale } from 'date-fns';

/**
 * Map of supported locale codes to date-fns Locale objects
 *
 * Add new locales here as needed. The key should match the
 * language code or language-region code returned by the device.
 */
const LOCALE_MAP: Record<string, Locale> = {
  // English variants
  'en': enUS,
  'en-US': enUS,
  'en-GB': enGB,
  'en-AU': enAU,
  'en-CA': enCA,
  // European languages
  'de': de,
  'de-DE': de,
  'fr': fr,
  'fr-FR': fr,
  'es': es,
  'es-ES': es,
  'it': it,
  'it-IT': it,
  'nl': nl,
  'nl-NL': nl,
  'pt': pt,
  'pt-PT': pt,
  'pt-BR': pt,
  // Asian languages
  'ja': ja,
  'ja-JP': ja,
  'ko': ko,
  'ko-KR': ko,
  'zh': zhCN,
  'zh-CN': zhCN,
  'zh-Hans': zhCN,
};

/**
 * Default locale to use when device locale is not supported
 */
const DEFAULT_LOCALE = enUS;

/**
 * Cached locale settings to avoid repeated Intl API calls
 */
let cachedLocale: Locale | null = null;
let cachedHour12: boolean | null = null;
let cachedLocaleCode: string | null = null;

/**
 * Get the device's locale code using the Intl API
 *
 * @returns The device locale code (e.g., 'en-US', 'de-DE')
 */
export function getDeviceLocaleCode(): string {
  if (cachedLocaleCode !== null) {
    return cachedLocaleCode;
  }

  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions();
    cachedLocaleCode = resolved.locale || 'en-US';
    return cachedLocaleCode;
  } catch {
    cachedLocaleCode = 'en-US';
    return cachedLocaleCode;
  }
}

/**
 * Get the date-fns Locale object for the device's locale
 *
 * Falls back to en-US if the device locale is not supported.
 *
 * @returns The date-fns Locale object
 */
export function getDeviceLocale(): Locale {
  if (cachedLocale !== null) {
    return cachedLocale;
  }

  const localeCode = getDeviceLocaleCode();

  // Try exact match first
  if (LOCALE_MAP[localeCode]) {
    cachedLocale = LOCALE_MAP[localeCode];
    return cachedLocale;
  }

  // Try language code only (e.g., 'en' from 'en-US')
  const languageCode = localeCode.split('-')[0];
  if (LOCALE_MAP[languageCode]) {
    cachedLocale = LOCALE_MAP[languageCode];
    return cachedLocale;
  }

  // Fall back to default
  cachedLocale = DEFAULT_LOCALE;
  return cachedLocale;
}

/**
 * Check if the device prefers 12-hour time format
 *
 * Uses the Intl API to detect the user's time format preference.
 * Returns true for 12-hour format (e.g., US), false for 24-hour format (e.g., most of Europe).
 *
 * @returns true if 12-hour format is preferred, false for 24-hour
 */
export function uses12HourClock(): boolean {
  if (cachedHour12 !== null) {
    return cachedHour12;
  }

  try {
    const resolved = Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions();
    // hour12 can be undefined in some implementations, default to true (US-style)
    cachedHour12 = resolved.hour12 !== false;
    return cachedHour12;
  } catch {
    cachedHour12 = true;
    return cachedHour12;
  }
}

/**
 * Get the appropriate time format string based on device locale preferences
 *
 * @returns 'h:mm a' for 12-hour format, 'HH:mm' for 24-hour format
 */
export function getTimeFormatString(): string {
  return uses12HourClock() ? 'h:mm a' : 'HH:mm';
}

/**
 * Get the appropriate date-time format string based on device locale preferences
 *
 * @returns Format string like 'MMM d, yyyy h:mm a' or 'MMM d, yyyy HH:mm'
 */
export function getDateTimeFormatString(): string {
  return uses12HourClock() ? 'MMM d, yyyy h:mm a' : 'MMM d, yyyy HH:mm';
}

/**
 * Get the appropriate short date-time format string
 *
 * @returns Format string like 'MMM d, h:mm a' or 'MMM d, HH:mm'
 */
export function getShortDateTimeFormatString(): string {
  return uses12HourClock() ? 'MMM d, h:mm a' : 'MMM d, HH:mm';
}

/**
 * Clear the cached locale settings
 *
 * Useful for testing or when locale settings might have changed.
 */
export function clearLocaleCache(): void {
  cachedLocale = null;
  cachedHour12 = null;
  cachedLocaleCode = null;
}

/**
 * Get locale options for date-fns format function
 *
 * Returns an object that can be spread into date-fns format options.
 *
 * @returns Object with locale property set to device locale
 */
export function getFormatLocaleOptions(): { locale: Locale } {
  return { locale: getDeviceLocale() };
}
