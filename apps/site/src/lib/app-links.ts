/** The Android app's page in RuStore, with the marks RuStore asks for on its button (they count taps on it). */
export const RUSTORE_URL = 'https://www.rustore.ru/catalog/app/ru.canrush.app?utm_source=available_in_rustore&utm_medium=ru.canrush.app&rsm=1&mt_link_id=iios36&mt_sub1=ru.canrush.app';

/**
 * The release APK for phones without RuStore: `ANDROID_APK_URL` — an https address or a path on this site. Without it
 * the site offers RuStore only, so a button never leads nowhere.
 */
export function androidApkUrl(): string | null {
  const value = process.env.ANDROID_APK_URL?.trim();
  if (!value) return null;
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  try { return new URL(value).protocol === 'https:' ? value : null; } catch { return null; }
}
