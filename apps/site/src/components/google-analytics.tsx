'use client';

import { useEffect } from 'react';
import { COOKIE_CONSENT_EVENT, hasCookieConsent } from '@/lib/cookie-consent';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    __canrushGoogleAnalytics?: string;
  }
}

function initializeGoogleAnalytics(id: string): void {
  if (window.__canrushGoogleAnalytics) return;
  window.__canrushGoogleAnalytics = id;
  window.dataLayer = window.dataLayer ?? [];
  // gtag.js reads the `arguments` object itself, so the queue keeps the snippet's shape.
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag('js', new Date());
  // Client-side navigations are counted by GA4 enhanced measurement (browser history events).
  window.gtag('config', id);
  const src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  if (!document.querySelector(`script[src="${src}"]`)) {
    const script = document.createElement('script');
    script.async = true;
    script.src = src;
    document.head.append(script);
  }
}

/** Google Analytics 4 starts only after the cookie notice is accepted, like Yandex Metrika. */
export function GoogleAnalytics({ id }: { id: string }) {
  useEffect(() => {
    const handleConsent = () => initializeGoogleAnalytics(id);
    if (hasCookieConsent()) handleConsent();
    window.addEventListener(COOKIE_CONSENT_EVENT, handleConsent);
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, handleConsent);
  }, [id]);
  return null;
}
