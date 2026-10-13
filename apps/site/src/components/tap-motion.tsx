'use client';

import { useEffect, useRef } from 'react';

const STORAGE_KEY = 'canrush:tap-motion';
const DURATION_MS = 700;

function play(item: HTMLElement, elapsed = 0) {
  item.removeAttribute('data-activated');
  item.style.setProperty('--tab-delay', `${-elapsed}ms`);
  void item.offsetWidth;
  item.setAttribute('data-activated', '');
}

/**
 * Plays a one-shot icon animation for tapped `[data-motion]` controls inside the closest `[data-motion-scope]`.
 * Navigation remounts the header, so the animation continues on the next page via a negative delay.
 */
export function TapMotion() {
  const anchor = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const scope = anchor.current?.closest<HTMLElement>('[data-motion-scope]');
    if (!scope) return;
    const name = scope.dataset.motionScope;
    try {
      const [scopeName, motion, time] = (sessionStorage.getItem(STORAGE_KEY) ?? '').split(':');
      const elapsed = Date.now() - Number(time);
      const item = scopeName === name ? scope.querySelector<HTMLElement>(`[data-motion="${motion}"]`) : null;
      if (item && item.closest('[data-motion-scope]') === scope && !item.hasAttribute('data-activated') && elapsed >= 0 && elapsed < DURATION_MS) {
        sessionStorage.removeItem(STORAGE_KEY);
        play(item, elapsed);
      }
    } catch {
      // Storage can be blocked; the tap still animates in place.
    }
    function onClick(event: MouseEvent) {
      const item = (event.target as Element).closest<HTMLElement>('[data-motion]');
      if (!item || item.closest('[data-motion-scope]') !== scope) return;
      play(item);
      try { sessionStorage.setItem(STORAGE_KEY, `${name}:${item.dataset.motion}:${Date.now()}`); } catch { /* optional continuation */ }
    }
    scope.addEventListener('click', onClick);
    return () => scope.removeEventListener('click', onClick);
  }, []);
  return <span ref={anchor} hidden />;
}
