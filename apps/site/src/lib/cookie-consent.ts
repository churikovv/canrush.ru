export const COOKIE_CONSENT_KEY = 'canrush.cookie-consent.v3';
export const COOKIE_CONSENT_EVENT = 'canrush:cookie-consent';

export function hasCookieConsent(): boolean {
  try {
    return window.localStorage.getItem(COOKIE_CONSENT_KEY) === 'accepted';
  } catch {
    return false;
  }
}
