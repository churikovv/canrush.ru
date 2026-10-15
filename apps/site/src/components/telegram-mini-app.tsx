'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useSyncExternalStore } from 'react';
import { authClient } from '@/lib/auth-client';
import {
  getServerTelegramAppState,
  getTelegramAppState,
  setTelegramAppState,
  subscribeTelegramApp,
  type TelegramWebApp,
} from '@/lib/telegram-web-app';
import type { TelegramSignInResult } from '@/lib/telegram-auth';

const SDK_URL = 'https://telegram.org/js/telegram-web-app.js';
/** Telegram passes launch params in the URL hash only on the first page; reloads keep this marker. */
const LAUNCH_KEY = 'canrush:telegram-app';
const SIGN_IN_KEY = 'canrush:telegram-sign-in';

function storageGet(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Private mode: the Mini App still works for the current page.
  }
}

function loadSdk(): Promise<TelegramWebApp | null> {
  if (window.Telegram?.WebApp) return Promise.resolve(window.Telegram.WebApp);
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => resolve(window.Telegram?.WebApp ?? null);
    script.onerror = () => resolve(null);
    document.head.append(script);
  });
}

export async function signInWithTelegram(webApp: TelegramWebApp, createAccount: boolean): Promise<TelegramSignInResult | { status: 'error'; message: string }> {
  const { data, error } = await authClient.$fetch<TelegramSignInResult>('/telegram/sign-in', {
    method: 'POST',
    body: { initData: webApp.initData, createAccount },
  });
  if (error || !data) return { status: 'error', message: error?.message || 'Не удалось войти через Telegram.' };
  return data;
}

export function useTelegramApp() {
  return useSyncExternalStore(subscribeTelegramApp, getTelegramAppState, getServerTelegramAppState);
}

/**
 * Activates only inside Telegram: loads the SDK, signs a linked member in, handles the
 * native Back button and opens external links through Telegram instead of the WebView.
 */
export function TelegramMiniApp() {
  const router = useRouter();
  const pathname = usePathname();
  const { webApp } = useTelegramApp();

  useEffect(() => {
    const launched = window.location.hash.includes('tgWebAppData=') || storageGet(LAUNCH_KEY) === '1';
    if (!launched) return;
    storageSet(LAUNCH_KEY, '1');
    document.documentElement.dataset.telegramApp = '';

    let cancelled = false;
    void (async () => {
      const app = await loadSdk();
      if (cancelled || !app?.initData) return;
      app.ready();
      app.expand();
      setTelegramAppState({ webApp: app });

      // One automatic attempt per Telegram launch: reloads must not re-consume link codes.
      if (storageGet(SIGN_IN_KEY) === app.initData) {
        const session = await authClient.getSession();
        setTelegramAppState({ auth: session.data ? 'signed-in' : 'unlinked' });
        return;
      }
      storageSet(SIGN_IN_KEY, app.initData);
      const linking = app.initDataUnsafe.start_param?.startsWith('link_') ?? false;
      if (!linking) {
        const session = await authClient.getSession();
        if (session.data) {
          setTelegramAppState({ auth: 'signed-in' });
          return;
        }
      }
      setTelegramAppState({ auth: 'signing-in' });
      const result = await signInWithTelegram(app, false);
      if (cancelled) return;
      if (result.status === 'error') {
        setTelegramAppState({ auth: 'unlinked' });
        if (linking) app.showAlert(result.message);
        return;
      }
      setTelegramAppState({ auth: result.status });
      if (result.status !== 'signed-in') return;
      if (result.linked) {
        app.showAlert('Telegram привязан к аккаунту CanRush.');
        router.push('/profile');
      }
      router.refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!webApp) return;
    const handleBack = () => {
      if (window.history.length > 1) router.back();
      else router.push('/');
    };
    if (pathname === '/') webApp.BackButton.hide();
    else webApp.BackButton.show();
    webApp.BackButton.onClick(handleBack);
    return () => webApp.BackButton.offClick(handleBack);
  }, [pathname, router, webApp]);

  useEffect(() => {
    if (!webApp) return;
    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      const anchor = (event.target as Element | null)?.closest?.('a[href]');
      if (!(anchor instanceof HTMLAnchorElement) || anchor.hasAttribute('download')) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin === window.location.origin || !/^https?:$/u.test(url.protocol)) return;
      event.preventDefault();
      if (url.hostname === 't.me') webApp.openTelegramLink(url.href);
      else webApp.openLink(url.href);
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [webApp]);

  return null;
}
