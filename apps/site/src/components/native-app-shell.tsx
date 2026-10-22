'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useTransition } from 'react';
import { hideSplash, isNativeApp, setSystemBars } from '@/lib/native-app';

/** Pull distance (px, after resistance) that triggers a refresh, and the furthest the indicator travels. */
const THRESHOLD = 72;
const MAX_PULL = 120;
/** The spinner stays at least this long, so a fast refresh does not flash. */
const MIN_SPIN_MS = 600;

/** `rgb(r, g, b)` from getComputedStyle → `#rrggbb` for the shell; transparent or unknown → null. */
function hexColor(value: string): string | null {
  const match = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/u.exec(value);
  if (!match || match[4] === '0') return null;
  return `#${match.slice(1, 4).map(part => Number(part).toString(16).padStart(2, '0')).join('')}`;
}

/** Bar icons go light on a dark backing: decided by the colour actually painted, whatever set it (site theme, system). */
function isDarkColor(hex: string): boolean {
  const [r, g, b] = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
  return 0.2126 * (r ?? 1) + 0.7152 * (g ?? 1) + 0.0722 * (b ?? 1) < 0.5;
}

/** A touch inside these never pulls: open dialogs, maps, horizontal carousels and anything scrolled down. */
function startsBlocked(target: EventTarget | null): boolean {
  if (document.querySelector('dialog[open]')) return true;
  for (let element = target instanceof Element ? target : null; element && element !== document.body; element = element.parentElement) {
    if (element.matches('[data-no-pull], .store-map, ymaps, input, textarea, select')) return true;
    if (element.scrollTop > 0) return true;
  }
  return false;
}

/**
 * Android app only (root layout): hides the launch screen once the page is painted, marks `<html data-native-app>`
 * and adds pull-to-refresh — pulling down at the top of a page refreshes its server data in place
 * (router.refresh keeps scroll and client state), with the Canrush mark spinning in a ring.
 */
export function NativeAppShell() {
  const router = useRouter();
  const indicator = useRef<HTMLDivElement>(null);
  const [pending, startTransition] = useTransition();
  const spin = useRef<{ startedAt: number } | null>(null);

  useEffect(() => {
    if (!isNativeApp()) return;
    const root = document.documentElement;
    root.dataset.nativeApp = '';
    requestAnimationFrame(() => hideSplash());

    // The page draws under the system bars (viewport-fit=cover in the layout); on older WebViews the shell paints
    // them with the page's colours. Re-synced when the site theme (server-rendered attribute) or the phone's changes.
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
    const syncBars = () => {
      // After the theme's styles apply: the colours are read from the page itself.
      requestAnimationFrame(() => {
        const surface = hexColor(getComputedStyle(document.body).backgroundColor) ?? '#ffffff';
        const top = hexColor(getComputedStyle(document.querySelector('.site-shell') ?? document.body).backgroundColor) ?? surface;
        const tabBar = document.querySelector('.site-tab-bar');
        const bottom = (tabBar && hexColor(getComputedStyle(tabBar).backgroundColor)) ?? surface;
        void setSystemBars(isDarkColor(top), { top, bottom });
      });
    };
    syncBars();
    const themeObserver = new MutationObserver(syncBars);
    themeObserver.observe(root, { attributes: true, attributeFilter: ['data-site-theme'] });
    // A phone theme switch also restyles the bars natively (SystemBars resets the window background after us),
    // so the colours are sent again once that settles.
    let resync = 0;
    const onSystemTheme = () => { syncBars(); window.clearTimeout(resync); resync = window.setTimeout(syncBars, 400); };
    systemDark.addEventListener('change', onSystemTheme);
    const stopBars = () => { themeObserver.disconnect(); systemDark.removeEventListener('change', onSystemTheme); window.clearTimeout(resync); };

    const element = indicator.current;
    if (!element) return stopBars;

    let startX = 0, startY = 0, distance = 0, tracking = false;
    const show = (pull: number, state: 'idle' | 'pulling' | 'ready' | 'refreshing') => {
      element.style.setProperty('--pull', String(pull));
      element.dataset.state = state;
    };
    const onStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (spin.current || event.touches.length !== 1 || !touch || window.scrollY > 0 || startsBlocked(event.target)) return;
      startX = touch.clientX; startY = touch.clientY; distance = 0; tracking = true;
    };
    const onMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!tracking || !touch) return;
      const dx = touch.clientX - startX, dy = touch.clientY - startY;
      // A sideways swipe (carousel) or scrolling up is not a pull.
      if (distance === 0 && (Math.abs(dx) > Math.abs(dy) || dy <= 0)) { if (Math.abs(dx) > 8 || dy < -8) tracking = false; return; }
      if (window.scrollY > 0) { tracking = false; show(0, 'idle'); return; }
      distance = Math.min(MAX_PULL, Math.max(0, dy) * 0.5);
      if (event.cancelable) event.preventDefault();
      show(distance, distance >= THRESHOLD ? 'ready' : 'pulling');
    };
    const onEnd = () => {
      if (!tracking) return;
      tracking = false;
      if (distance < THRESHOLD) { show(0, 'idle'); return; }
      spin.current = { startedAt: Date.now() };
      show(THRESHOLD * 0.8, 'refreshing');
      navigator.vibrate?.(10);
      startTransition(() => router.refresh());
    };
    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onEnd);
    return () => {
      stopBars();
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
    };
  }, [router]);

  // The refresh transition ended: let the ring finish its minimum turn, then slide the indicator away.
  useEffect(() => {
    const started = spin.current;
    if (pending || !started) return;
    const timer = window.setTimeout(() => {
      spin.current = null;
      if (indicator.current) { indicator.current.dataset.state = 'idle'; indicator.current.style.setProperty('--pull', '0'); }
    }, Math.max(0, MIN_SPIN_MS - (Date.now() - started.startedAt)));
    return () => window.clearTimeout(timer);
  }, [pending]);

  return <div ref={indicator} className="pull-refresh" data-state="idle" aria-hidden="true">
    <svg viewBox="0 0 40 40" width="40" height="40">
      <circle className="pull-refresh-track" cx="20" cy="20" r="16" />
      <circle className="pull-refresh-ring" cx="20" cy="20" r="16" pathLength="100" />
      {/* Position in the SVG attribute, scale in CSS: a CSS transform would replace the attribute. */}
      <g transform="translate(11.35 13.75)"><g className="pull-refresh-mark">
        <path d="M9.491.063 3.95.044c-.098.3-.127.783-.262 1.011-.275.465-1.044 1.013-1.292 1.469-.06.11-.213.878-.244 1.026l-.436 2.115-.719 3.383c-.099.473-.285 1.264-.342 1.724.27.388.864 1.186 1.035 1.569-.024.149-.045.314-.085.458l5.165.009c.12-.57.262-.66.668-1.083.324-.337.727-.688.974-1.077.1-.203.176-.787.22-1.018l.359-1.825-1.534-.002c-.347-.005-.684-.008-1.03-.025-.132.742-.155 1.523-.888 2.003-.46.301-1.041.319-1.39-.148-.297-.398-.187-.91-.09-1.363.268-1.253.533-2.506.796-3.76.104-.49.298-.95.764-1.236.446-.277.96-.212 1.221.244.235.41.161.861.087 1.298l1.058-.007c.622-.96 1.208-2.134 1.82-3.048a10 10 0 0 1-.496-.728c.041-.335.106-.624.178-.955Z" />
        <path d="M17.297.091 11.724.076c-.372.555-.724 1.185-1.074 1.758L7.634 6.875c1.054-.01 2.246-.02 3.297.009-.17.557-.497 1.166-.735 1.71-.501 1.148-1.06 2.293-1.556 3.441l-.048.145.021.03c.068-.042.086-.05.144-.103 1.944-1.828 4.09-3.653 6.093-5.458l1.307-1.162c.206-.184.527-.452.705-.646a105 105 0 0 0-3.325-.012c.498-.69 1.116-1.444 1.653-2.114.697-.878 1.399-1.753 2.107-2.624Z" />
      </g></g>
    </svg>
  </div>;
}
