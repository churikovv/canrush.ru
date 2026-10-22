/**
 * Digital Asset Links: proves to Android that canrush.ru belongs to the app ru.canrush.app, so App Links
 * (the intent filter with autoVerify in apps/android) open site links — sign-in from email included — in the app.
 * RELEASE_KEY — the release key the app is signed with for RuStore (~/.canrush-signing, apps/android/README.md).
 * Google Play re-signs apps with its own key: add that SHA-256 from Play Console → App integrity
 * to ANDROID_APP_SHA256 (comma-separated) without a code change.
 */
const PACKAGE_NAME = 'ru.canrush.app';
const RELEASE_KEY = '6A:B9:4C:53:E1:99:C3:EC:7F:64:E2:74:92:C2:D9:93:FD:B1:52:9D:20:97:2A:CF:F5:5F:58:C3:EF:F0:97:27';
const FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/u;

export function GET() {
  const extra = (process.env.ANDROID_APP_SHA256 ?? '').split(',').map(value => value.trim().toUpperCase()).filter(value => FINGERPRINT.test(value));
  const fingerprints = [...new Set([RELEASE_KEY, ...extra])];
  return Response.json([{
    relation: ['delegate_permission/common.handle_all_urls'],
    target: { namespace: 'android_app', package_name: PACKAGE_NAME, sha256_cert_fingerprints: fingerprints },
  }], { headers: { 'cache-control': 'public, max-age=3600' } });
}
