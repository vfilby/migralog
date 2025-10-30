import { beforeSend, beforeSendTransaction } from '../sentryPrivacy';
import type { ErrorEvent, TransactionEvent, Breadcrumb } from '@sentry/react-native';
import type { EventHint } from '@sentry/core';

const mockHint: EventHint = {};

// Helper to create ErrorEvent with minimal required properties
const createErrorEvent = (partial: any): ErrorEvent => ({
  ...partial,
} as ErrorEvent);

// Helper to create TransactionEvent with minimal required properties
const createTransactionEvent = (partial: any): TransactionEvent => ({
  ...partial,
} as TransactionEvent);

describe('sentryPrivacy', () => {
  describe('beforeSend - Error Event Scrubbing', () => {
    it('should scrub medication names from extra data', () => {
      const event = createErrorEvent({
        extra: {
          medicationName: 'Ibuprofen',
          dose: '400mg',
          context: 'User took medication',
        },
      });

      const result = beforeSend(event, mockHint);

      expect(result?.extra).toEqual({
        medicationName: '[Redacted]',
        dose: '[Redacted]',
        context: 'User took medication',
      });
    });

    it('should scrub episode details from contexts', () => {
      const event = createErrorEvent({
        contexts: {
          episode: {
            intensity: 8,
            pain_location: 'frontal',
            symptoms: ['nausea', 'photophobia'],
            triggers: ['stress'],
          },
        },
      });

      const result = beforeSend(event, mockHint);

      expect(result?.contexts?.episode).toEqual({
        intensity: '[Redacted]',
        pain_location: '[Redacted]',
        symptoms: '[Redacted]',
        triggers: '[Redacted]',
      });
    });

    it('should scrub user data completely', () => {
      const event = createErrorEvent({
        user: {
          id: 'user123',
          email: 'user@example.com',
          username: 'johndoe',
          ip_address: '192.168.1.1',
        },
      });

      const result = beforeSend(event, mockHint);

      expect(result?.user).toEqual({
        id: '[User ID Redacted]',
        ip_address: undefined,
        email: undefined,
        username: undefined,
      });
    });

    it('should scrub URLs from request data', () => {
      const event = createErrorEvent({
        request: {
          url: 'https://example.com/api?medicationId=123&userId=456',
        },
      });

      const result = beforeSend(event, mockHint);

      expect(result?.request?.url).toBe('https://example.com/api');
    });

    it('should redact query strings from request', () => {
      const event = createErrorEvent({
        request: {
          query_string: 'sensitive=data&medication=ibuprofen',
        },
      });

      const result = beforeSend(event, mockHint);

      expect(result?.request?.query_string).toBe('[Redacted]');
    });

    it('should preserve request headers (not scrubbed by default)', () => {
      const event = createErrorEvent({
        request: {
          headers: {
            'User-Agent': 'Mobile',
            'X-Custom-Header': 'value',
          },
        },
      });

      const result = beforeSend(event, mockHint);

      expect(result?.request?.headers).toEqual({
        'User-Agent': 'Mobile',
        'X-Custom-Header': 'value',
      });
    });

    it('should scrub breadcrumb messages with phone numbers', () => {
      const event = createErrorEvent({
        breadcrumbs: [
          {
            message: 'User called 555-123-4567',
            timestamp: Date.now() / 1000,
          } as Breadcrumb,
        ],
      });

      const result = beforeSend(event, mockHint);

      expect(result?.breadcrumbs?.[0]?.message).toContain('[Phone Redacted]');
      expect(result?.breadcrumbs?.[0]?.message).not.toContain('555-123-4567');
    });

    it('should scrub breadcrumb messages with email addresses', () => {
      const event = createErrorEvent({
        breadcrumbs: [
          {
            message: 'User logged in with user@example.com',
            timestamp: Date.now() / 1000,
          } as Breadcrumb,
        ],
      });

      const result = beforeSend(event, mockHint);

      expect(result?.breadcrumbs?.[0]?.message).toContain('[Email Redacted]');
      expect(result?.breadcrumbs?.[0]?.message).not.toContain('user@example.com');
    });

    it('should scrub breadcrumb data objects', () => {
      const event = createErrorEvent({
        breadcrumbs: [
          {
            category: 'episode',
            data: {
              intensity: 9,
              notes: 'Severe migraine',
            },
            timestamp: Date.now() / 1000,
          } as Breadcrumb,
        ],
      });

      const result = beforeSend(event, mockHint);

      expect(result?.breadcrumbs?.[0]?.data).toEqual({
        intensity: '[Redacted]',
        notes: '[Redacted]',
      });
    });

    it('should handle nested objects with sensitive data', () => {
      const event = createErrorEvent({
        extra: {
          user: {
            profile: {
              medicationHistory: ['Aspirin', 'Ibuprofen'],
              location: { latitude: 40.7128, longitude: -74.0060 },
            },
          },
        },
      });

      const result = beforeSend(event, mockHint);

      expect((result?.extra?.user as any)?.profile?.medicationHistory).toBe('[Redacted]');
      expect((result?.extra?.user as any)?.profile?.location).toBe('[Redacted]');
    });

    it('should handle arrays of sensitive data', () => {
      const event = createErrorEvent({
        extra: {
          medications: [
            { name: 'Ibuprofen', dose: '400mg' },
            { name: 'Aspirin', dose: '500mg' },
          ],
        },
      });

      const result = beforeSend(event, mockHint);

      // The key 'medications' contains 'medication' which is sensitive,
      // so the entire array value gets redacted as a single [Redacted] string
      expect(result?.extra?.medications).toBe('[Redacted]');
    });

    it('should preserve exception stack traces', () => {
      const event = createErrorEvent({
        exception: {
          values: [
            {
              type: 'Error',
              value: 'Something went wrong',
              stacktrace: {
                frames: [
                  { function: 'myFunction', lineno: 10, filename: 'app.js' },
                ],
              },
            },
          ],
        },
      });

      const result = beforeSend(event, mockHint);

      expect(result?.exception?.values?.[0]?.stacktrace).toBeDefined();
      expect(result?.exception?.values?.[0]?.value).toBe('Something went wrong');
    });

    it('should return the event even if scrubbing throws an error (graceful degradation)', () => {
      const event: any = {
        get extra() {
          throw new Error('Object is sealed');
        },
      };

      const result = beforeSend(event, mockHint);

      // With graceful degradation, we send the event as-is instead of dropping it
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
    });

    it('should handle null and undefined gracefully', () => {
      const event = createErrorEvent({
        extra: {
          data: null,
          empty: undefined,
          valid: 'value',
        },
      });

      const result = beforeSend(event, mockHint);

      expect(result?.extra).toEqual({
        data: null,
        empty: undefined,
        valid: 'value',
      });
    });

    it('should scrub case-insensitive sensitive keys', () => {
      const event = createErrorEvent({
        extra: {
          MEDICATION: 'Aspirin',
          Medication: 'Ibuprofen',
          medicationName: 'Tylenol',
          MedicationName: 'Naproxen',
        },
      });

      const result = beforeSend(event, mockHint);

      expect(result?.extra?.MEDICATION).toBe('[Redacted]');
      expect(result?.extra?.Medication).toBe('[Redacted]');
      expect(result?.extra?.medicationName).toBe('[Redacted]');
      expect(result?.extra?.MedicationName).toBe('[Redacted]');
    });
  });

  describe('beforeSendTransaction - Transaction Event Scrubbing', () => {
    it('should scrub breadcrumbs in transaction events', () => {
      const event = createTransactionEvent({
        breadcrumbs: [
          {
            message: 'User took Ibuprofen',
            data: { medicationName: 'Ibuprofen' },
            timestamp: Date.now() / 1000,
          } as Breadcrumb,
        ],
      });

      const result = beforeSendTransaction(event, mockHint);

      expect(result?.breadcrumbs?.[0]?.data?.medicationName).toBe('[Redacted]');
    });

    it('should scrub contexts in transaction events', () => {
      const event = createTransactionEvent({
        contexts: {
          trace: {
            op: 'http.client',
            status_code: 200,
            span_id: '1234567890abcdef',
            trace_id: '1234567890abcdef1234567890abcdef',
          },
          user: {
            id: 'user123',
            email: 'test@example.com',
          },
        },
      });

      const result = beforeSendTransaction(event, mockHint);

      expect(result?.contexts?.trace?.op).toBe('http.client');
      expect(result?.contexts?.trace?.status_code).toBe(200);
      // Note: beforeSendTransaction uses scrubObject() which doesn't have special user handling
      // like beforeSend() does. It only redacts based on SENSITIVE_KEYS matching.
      // 'id' is not in SENSITIVE_KEYS, so it stays. 'email' is in SENSITIVE_KEYS so it's redacted.
      expect(result?.contexts?.user?.id).toBe('user123');
      expect(result?.contexts?.user?.email).toBe('[Redacted]');
    });

    it('should scrub extra data in transaction events', () => {
      const event = createTransactionEvent({
        extra: {
          episode_intensity: 8,
          user_location: 'Home',
          api_response: { medication: 'Aspirin' },
        },
      });

      const result = beforeSendTransaction(event, mockHint);

      expect(result?.extra?.episode_intensity).toBe('[Redacted]');
      expect(result?.extra?.user_location).toBe('[Redacted]');
      expect((result?.extra?.api_response as any)?.medication).toBe('[Redacted]');
    });

    it('should return the event even if transaction scrubbing throws an error (graceful degradation)', () => {
      const event: any = {
        get breadcrumbs() {
          throw new Error('Array is immutable');
        },
      };

      const result = beforeSendTransaction(event, mockHint);

      // With graceful degradation, we send the event as-is instead of dropping it
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
    });
  });

  describe('URL Scrubbing', () => {
    it('should remove all query parameters from URLs', () => {
      const event = createErrorEvent({
        request: {
          url: 'https://api.example.com/episodes?id=123&userId=456&medicationId=789',
        },
      });

      const result = beforeSend(event, mockHint);

      expect(result?.request?.url).toBe('https://api.example.com/episodes');
      expect(result?.request?.url).not.toContain('?');
    });

    it('should handle invalid URLs gracefully', () => {
      const event = createErrorEvent({
        request: {
          url: 'not-a-valid-url',
        },
      });

      const result = beforeSend(event, mockHint);

      expect(result?.request?.url).toBe('[Redacted URL]');
    });

    it('should handle empty URLs', () => {
      const event = createErrorEvent({
        request: {
          url: '',
        },
      });

      const result = beforeSend(event, mockHint);

      // Empty URL might stay empty or be redacted depending on implementation
      expect(result?.request?.url).toBeDefined();
    });
  });

  describe('Sensitive Fields Coverage', () => {
    it('should scrub all documented medication fields', () => {
      const event = createErrorEvent({
        extra: {
          medication: 'Aspirin',
          medicationName: 'Ibuprofen',
          medication_name: 'Tylenol',
          dose: '400mg',
          dosage: '500mg',
          units: 'mg',
        },
      });

      const result = beforeSend(event, mockHint);

      Object.values(result?.extra || {}).forEach(value => {
        if (typeof value === 'string' && value.length > 0) {
          expect(value).toBe('[Redacted]');
        }
      });
    });

    it('should scrub all documented episode fields', () => {
      const event = createErrorEvent({
        extra: {
          intensity: 8,
          pain_location: 'frontal',
          painLocation: 'temporal',
          symptom: 'nausea',
          symptoms: ['nausea', 'photophobia'],
          trigger: 'stress',
          triggers: ['stress', 'weather'],
        },
      });

      const result = beforeSend(event, mockHint);

      Object.values(result?.extra || {}).forEach(value => {
        expect(value).toBe('[Redacted]');
      });
    });

    it('should scrub all documented personal information fields', () => {
      const event = createErrorEvent({
        extra: {
          email: 'test@example.com',
          phone: '555-123-4567',
          name: 'John Doe',
          username: 'johndoe',
          userId: 'user123',
          user_id: 'user456',
        },
      });

      const result = beforeSend(event, mockHint);

      Object.values(result?.extra || {}).forEach(value => {
        expect(value).toBe('[Redacted]');
      });
    });
  });
});
