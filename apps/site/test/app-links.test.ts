import { afterEach, describe, expect, it } from 'vitest';
import { androidApkUrl } from '../src/lib/app-links';

describe('androidApkUrl', () => {
  const saved = process.env.ANDROID_APK_URL;
  afterEach(() => { if (saved === undefined) delete process.env.ANDROID_APK_URL; else process.env.ANDROID_APK_URL = saved; });
  it('takes an https address or a path on the site, nothing else', () => {
    delete process.env.ANDROID_APK_URL;
    expect(androidApkUrl()).toBeNull();
    process.env.ANDROID_APK_URL = 'https://canrush.ru/downloads/canrush.apk';
    expect(androidApkUrl()).toBe('https://canrush.ru/downloads/canrush.apk');
    process.env.ANDROID_APK_URL = '/downloads/canrush.apk';
    expect(androidApkUrl()).toBe('/downloads/canrush.apk');
    for (const bad of ['http://example.com/a.apk', '//evil.example/a.apk', 'javascript:alert(1)', 'not a url']) {
      process.env.ANDROID_APK_URL = bad;
      expect(androidApkUrl()).toBeNull();
    }
  });
});
