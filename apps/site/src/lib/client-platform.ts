/** Where a request comes from, for the admin's app analytics («Приложения»). */
export type ClientPlatform = 'ios' | 'android' | 'telegram' | 'web';

/**
 * The apps add their mark to the WebView's User-Agent (`appendUserAgent` in apps/ios and apps/android
 * capacitor.config.ts); the Telegram Mini App is told by the page itself (`data-telegram-app`), as Telegram keeps the
 * browser's own User-Agent. Anything else is the website.
 */
export function clientPlatform(userAgent: string | null, telegram = false): ClientPlatform {
  if (userAgent?.includes('CanrushApp/iOS')) return 'ios';
  if (userAgent?.includes('CanrushApp/Android')) return 'android';
  return telegram ? 'telegram' : 'web';
}
