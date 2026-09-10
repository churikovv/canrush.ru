'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { COOKIE_CONSENT_EVENT, hasCookieConsent } from '@/lib/cookie-consent';

const COUNTER_ID = 112448449;
const SCRIPT_URL = `https://mc.yandex.ru/metrika/tag.js?id=${COUNTER_ID}`;

type MetrikaFunction = ((...args: unknown[]) => void) & {
  a?: unknown[][];
  l?: number;
};

declare global {
  interface Window {
    ym?: MetrikaFunction;
    __canrushMetrikaInitialized?: boolean;
  }
}

function protectFormFields(): MutationObserver {
  const markFields = (root: ParentNode) => {
    root.querySelectorAll('input, textarea').forEach((field) => field.classList.add('ym-disable-keys'));
  };
  markFields(document);
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches('input, textarea')) node.classList.add('ym-disable-keys');
        markFields(node);
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return observer;
}

function initializeMetrika(): void {
  if (window.__canrushMetrikaInitialized) return;
  window.__canrushMetrikaInitialized = true;

  if (!window.ym) {
    const queue: MetrikaFunction = (...args: unknown[]) => {
      queue.a = queue.a ?? [];
      queue.a.push(args);
    };
    queue.l = Date.now();
    window.ym = queue;
  }

  if (!document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_URL}"]`)) {
    const script = document.createElement('script');
    script.async = true;
    script.src = SCRIPT_URL;
    document.head.append(script);
  }

  window.ym(COUNTER_ID, 'init', {
    ssr: true,
    webvisor: true,
    clickmap: true,
    ecommerce: 'dataLayer',
    referrer: document.referrer,
    url: window.location.href,
    accurateTrackBounce: true,
    trackLinks: true,
  });
}

export function YandexMetrika() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const route = search ? `${pathname}?${search}` : pathname;
  const previousRoute = useRef(route);

  useEffect(() => {
    const observer = protectFormFields();
    const handleConsent = () => initializeMetrika();
    if (hasCookieConsent()) initializeMetrika();
    window.addEventListener(COOKIE_CONSENT_EVENT, handleConsent);
    return () => {
      observer.disconnect();
      window.removeEventListener(COOKIE_CONSENT_EVENT, handleConsent);
    };
  }, []);

  useEffect(() => {
    const previous = previousRoute.current;
    previousRoute.current = route;
    if (previous === route || !window.__canrushMetrikaInitialized || !window.ym) return;
    window.ym(COUNTER_ID, 'hit', window.location.href, {
      referer: new URL(previous, window.location.origin).href,
      title: document.title,
    });
  }, [route]);

  return null;
}
