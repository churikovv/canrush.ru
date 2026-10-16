/** GA4 measurement id from `GOOGLE_ANALYTICS_ID`; anything else keeps Google Analytics off. */
export function googleAnalyticsId(value = process.env.GOOGLE_ANALYTICS_ID): string | null {
  const id = value?.trim() ?? '';
  return /^G-[A-Z0-9]{4,20}$/u.test(id) ? id : null;
}
