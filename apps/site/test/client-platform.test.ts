import { expect, it } from 'vitest';
import { clientPlatform } from '../src/lib/client-platform';

it('tells the apps, the Telegram Mini App and the website apart', () => {
  expect(clientPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 CanrushApp/iOS')).toBe('ios');
  expect(clientPlatform('Mozilla/5.0 (Linux; Android 14; wv) Chrome/130.0 Mobile Safari/537.36 CanrushApp/Android')).toBe('android');
  expect(clientPlatform('Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile Safari/537.36', true)).toBe('telegram');
  expect(clientPlatform('Mozilla/5.0 (Macintosh) Safari/605.1.15')).toBe('web');
  expect(clientPlatform(null)).toBe('web');
});
