'use client';
import { useEffect } from 'react';
import { registerPushDeviceAction } from '@/app/notifications/push-actions';
import { isNativeApp, nativePush, storePushToken } from '@/lib/native-app';

// The header (and this component) remounts on every navigation; push is set up once per page load.
let started = false;

/**
 * Inside the apps (Android: FCM or RuStore Push; iOS: APNs), for a signed-in member: asks for the notification
 * permission once, sends the device token to the server and opens the page a tapped push points to.
 */
export function PushRegistration({ signedIn }: { signedIn: boolean }) {
  useEffect(() => {
    if (!signedIn || started || !isNativeApp()) return;
    started = true;
    void (async () => {
      const push = await nativePush();
      if (!push) return;
      const save = (token: string, provider: 'fcm' | 'rustore' | 'apns') => {
        storePushToken(token);
        void registerPushDeviceAction(token, provider).catch(() => {});
      };
      // Phones without Google services (and builds without Firebase config) get pushes through RuStore.
      const registerRuStore = async () => {
        const token = await push.rustoreToken();
        if (token) save(token, 'rustore');
      };
      const provider = push.provider;
      if (provider) {
        await push.plugin.addListener('registration', ({ value }) => save(value, provider));
        await push.plugin.addListener('registrationError', () => { void registerRuStore(); });
      }
      await push.plugin.addListener('pushNotificationActionPerformed', ({ notification }) => {
        const url = notification.data?.url;
        // Only paths of this site: a push never sends the app elsewhere.
        if (typeof url === 'string' && /^\/(?!\/)/u.test(url)) window.location.assign(url);
      });
      let permission = await push.plugin.checkPermissions();
      if (permission.receive === 'prompt' || permission.receive === 'prompt-with-rationale') permission = await push.plugin.requestPermissions();
      if (permission.receive !== 'granted') return;
      if (provider) await push.plugin.register();
      else await registerRuStore();
    })().catch(() => { started = false; });
  }, [signedIn]);
  return null;
}
