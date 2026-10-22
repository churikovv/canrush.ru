import { isNativeApp } from '@/lib/native-app';

export const COOKIE_CONSENT_KEY = 'canrush.cookie-consent.v3';
export const COOKIE_CONSENT_EVENT = 'canrush:cookie-consent';

/**
 * Analytics (Yandex Metrica, Google Analytics, campaign attribution) load only with consent; on the site it is the
 * cookie notice. The Android app shows no notice, like other apps: usage statistics are on there and the privacy
 * policy says so (section «Приложение для Android»).
 */
export function hasCookieConsent(): boolean {
  if (isNativeApp()) return true;
  try {
    return window.localStorage.getItem(COOKIE_CONSENT_KEY) === 'accepted';
  } catch {
    return false;
  }
}
