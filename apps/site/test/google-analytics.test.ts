import { expect, it } from 'vitest';
import { googleAnalyticsId } from '@/lib/google-analytics';

it('turns Google Analytics on only for a GA4 measurement id', () => {
  expect(googleAnalyticsId(' G-699XL9P4R2 ')).toBe('G-699XL9P4R2');
  expect(googleAnalyticsId('')).toBeNull();
  expect(googleAnalyticsId(undefined)).toBeNull();
  expect(googleAnalyticsId('UA-12345-1')).toBeNull();
  expect(googleAnalyticsId('G-1"><script>')).toBeNull();
});
