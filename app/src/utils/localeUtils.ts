/**
 * Locale utilities for date/time formatting
 *
 * Provides device locale detection and date-fns locale mapping for
 * locale-aware date/time formatting throughout the app.
 */

import {
  enUS,
  enGB,
  de,
  fr,
  es,
  ja,
  zhCN,
  zhTW,
} from 'date-fns/locale';
import type { Locale } from 'date-fns';

/**
 * Time format string constants
 */
export const TIME_FORMAT_12H = 'h:mm a';
export const TIME_FORMAT_24H = 'HH:mm';
export const DATETIME_FORMAT_12H = 'MMM d, yyyy h:mm a';
export const DATETIME_FORMAT_24H = 'MMM d, yyyy HH:mm';
export const SHORT_DATETIME_FORMAT_12H = 'MMM d, h:mm a';
export const SHORT_DATETIME_FORMAT_24H = 'MMM d, HH:mm';

/**
 * Map of supported locale codes to date-fns Locale objects
 *
 * We include the most commonly used locales to balance bundle size
 * with coverage. Other locales fall back to en-US which provides
 * correct formatting behavior (the locale primarily affects things
 * like month/day names which are still readable in English).
 *
 * Add new locales here as needed. The key should match the
 * language code or language-region code returned by the device.
 */
const LOCALE_MAP: Record<string, Locale> = {
  // English variants (en-GB uses different date ordering)
  'en': enUS,
  'en-US': enUS,
  'en-GB': enGB,
  'en-AU': enGB, // Australia uses UK-style formatting
  'en-CA': enUS, // Canada uses US-style formatting
  // European languages
  'de': de,
  'de-DE': de,
  'de-AT': de,
  'de-CH': de,
  'fr': fr,
  'fr-FR': fr,
  'fr-CA': fr,
  'es': es,
  'es-ES': es,
  'es-MX': es,
  // Asian languages
  'ja': ja,
  'ja-JP': ja,
  'zh': zhCN,
  'zh-CN': zhCN,
  'zh-Hans': zhCN,
  'zh-TW': zhTW,
  'zh-Hant': zhTW,
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
    // hour12 can be undefined in some Intl implementations.
    // We explicitly check for true or undefined (defaulting to 12-hour US-style)
    cachedHour12 = resolved.hour12 === true || resolved.hour12 === undefined;
    return cachedHour12;
  } catch {
    cachedHour12 = true;
    return cachedHour12;
  }
}

/**
 * Get the appropriate time format string based on device locale preferences
 *
 * @returns TIME_FORMAT_12H for 12-hour format, TIME_FORMAT_24H for 24-hour format
 */
export function getTimeFormatString(): string {
  return uses12HourClock() ? TIME_FORMAT_12H : TIME_FORMAT_24H;
}

/**
 * Get the appropriate date-time format string based on device locale preferences
 *
 * @returns DATETIME_FORMAT_12H or DATETIME_FORMAT_24H based on locale
 */
export function getDateTimeFormatString(): string {
  return uses12HourClock() ? DATETIME_FORMAT_12H : DATETIME_FORMAT_24H;
}

/**
 * Get the appropriate short date-time format string
 *
 * @returns SHORT_DATETIME_FORMAT_12H or SHORT_DATETIME_FORMAT_24H based on locale
 */
export function getShortDateTimeFormatString(): string {
  return uses12HourClock() ? SHORT_DATETIME_FORMAT_12H : SHORT_DATETIME_FORMAT_24H;
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
