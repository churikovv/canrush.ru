'use client';
import { useCallback, useEffect, useRef, type MouseEvent, type SyntheticEvent } from 'react';

const PARAM = 'tab';

/** The page address without `?tab=…` and its `#…`, other parameters kept. */
function addressWithout() {
  const url = new URL(window.location.href);
  url.searchParams.delete(PARAM);
  url.hash = '';
  return `${url.pathname}${url.search}`;
}

/**
 * A full-screen sheet over the drink page (a modal `dialog`) that lives in the history, shared by the reviews and the
 * questions. Opening adds a history entry with the same address and `mark` in its state, so the system back gesture
 * closes the sheet. Not a `?tab=…` push: a server action inside (a saved review) made Next push its own entry over it,
 * and back reopened the sheet. Arriving with `?tab=<value>` (a notification, a feed link, `#review-<id>`) opens the sheet
 * at once and scrolls to that element; closing it drops the parameter.
 *
 * `open` goes on the card, a link to `?tab=<value>`, so a tap before the page hydrates still opens the sheet (a full
 * load with it open). `cancel` and `backdrop` go on the dialog; every way out — the arrow, the backdrop, Escape and back
 * — goes through `dismiss`.
 */
export function useHistorySheet(value: string, mark: string, initiallyOpen: boolean) {
  const dialog = useRef<HTMLDialogElement>(null);
  // Set while our `history.back()` is on its way: the arrow and the `close` event both ask to leave, and a second
  // back would leave the drink page itself.
  const leaving = useRef(false);
  // A tap on the card while that back is still on its way: the sheet opens once it lands (opened earlier, the late
  // back would close it again at once — the «tap does nothing» it looked like).
  const reopen = useRef(false);
  const marked = useCallback(() => (window.history.state as Record<string, unknown> | null)?.[mark] === true, [mark]);

  const show = useCallback(() => {
    const sheet = dialog.current;
    if (!sheet || sheet.open) return;
    sheet.showModal();
    sheet.scrollTop = 0;
  }, []);

  useEffect(() => {
    if (!initiallyOpen) return;
    show();
    const target = window.location.hash.slice(1);
    if (target) requestAnimationFrame(() => document.getElementById(target)?.scrollIntoView({ block: 'start' }));
  }, [initiallyOpen, show]);

  // Back (or forward) moves the sheet with the address.
  useEffect(() => {
    const sync = () => {
      leaving.current = false;
      const sheet = dialog.current;
      if (!sheet) return;
      if (reopen.current) {
        reopen.current = false;
        if (!marked()) window.history.pushState({ ...(window.history.state as object | null), [mark]: true }, '');
        show();
      } else if (marked()) show();
      else if (sheet.open) sheet.close();
    };
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, [mark, marked, show]);

  // After hydration the card opens the sheet in place. Standing on our own entry already (a stale one, or forward), it
  // does not add another: two entries made back land on the first and reopen the sheet.
  function open(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    if (leaving.current) { reopen.current = true; return; }
    if (!marked()) window.history.pushState({ ...(window.history.state as object | null), [mark]: true }, '');
    show();
  }

  // Leaving the sheet puts the history back the way it was before it: back over our own entry, else the arrival
  // parameter is dropped from the address. Safe to call twice.
  function leave() {
    if (leaving.current) return;
    if (marked()) { leaving.current = true; window.history.back(); return; }
    if (new URL(window.location.href).searchParams.get(PARAM) === value) window.history.replaceState(window.history.state, '', addressWithout());
  }
  // There is no `close` handler: that event sometimes came late, after the sheet had been opened again, and closed the new one.
  function dismiss() { leave(); dialog.current?.close(); }
  // `cancel` also bubbles from a file picker closed without a file and from dialogs inside: only the sheet's own counts.
  function cancel(event: SyntheticEvent<HTMLDialogElement>) { if (event.target !== event.currentTarget) return; event.preventDefault(); dismiss(); }
  function backdrop(event: MouseEvent<HTMLDialogElement>) { if (event.target === event.currentTarget) dismiss(); }

  return { dialog, open, dismiss, cancel, backdrop };
}
