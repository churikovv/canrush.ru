'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ACTION_NOT_FOUND_HEADER, isStaleBuildError, isTypingTarget, markSiteUpdated, onSiteUpdated, openModal, pageBusy, reloadForUpdate,
  restoreUpdateScroll,
} from '@/lib/site-update';

/**
 * After a deploy, an open page of the previous build keeps failing: its server actions are «not found», its late scripts
 * are gone. This watches for that — every server action goes through `fetch`, so the answer's header tells it — and
 * reloads the page once the member is not in the middle of something (`pageBusy`), keeping the scroll position. Until
 * then, and if a reload a moment ago did not help, a notice offers «Обновить». A hidden tab reloads when it comes back.
 */
export function SiteUpdate() {
  const [place, setPlace] = useState<HTMLElement | null>(null);

  useEffect(() => {
    restoreUpdateScroll();
    const original = window.fetch;
    const watched: typeof window.fetch = async (...args) => {
      const response = await original.apply(window, args);
      if (response.headers.get(ACTION_NOT_FOUND_HEADER) === '1') markSiteUpdated();
      return response;
    };
    window.fetch = watched;
    const rejected = (event: PromiseRejectionEvent) => { if (isStaleBuildError(event.reason)) markSiteUpdated(); };
    window.addEventListener('unhandledrejection', rejected);

    let typed = false;
    const typing = (event: Event) => { if (isTypingTarget(event.target)) typed = true; };
    const sent = () => { typed = false; };
    document.addEventListener('input', typing, true);
    document.addEventListener('submit', sent, true);

    let timer = 0;
    const settle = () => {
      if (document.visibilityState === 'hidden') return;
      if (!pageBusy(typed) && reloadForUpdate()) return;
      setPlace(openModal() ?? document.body);
    };
    const stop = onSiteUpdated(() => {
      settle();
      timer = window.setInterval(settle, 2000);
      document.addEventListener('visibilitychange', settle);
    });
    return () => {
      stop();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', settle);
      document.removeEventListener('input', typing, true);
      document.removeEventListener('submit', sent, true);
      window.removeEventListener('unhandledrejection', rejected);
      if (window.fetch === watched) window.fetch = original;
    };
  }, []);

  if (!place) return null;
  return createPortal(<div className="site-update" role="status">
    <span>Сайт обновился</span>
    <button type="button" onClick={() => location.reload()}>Обновить</button>
  </div>, place);
}
