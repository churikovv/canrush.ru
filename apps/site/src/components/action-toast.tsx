'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/** How long a toast stays before it fades; it fades for TOAST_LEAVE_MS. */
const TOAST_MS = 2600;
const TOAST_LEAVE_MS = 220;

/**
 * A short note over the page bottom (above the tab bar): it rises in, the mark draws itself, then it fades away.
 * `tone="error"` (a refusal like the pause between comments) gets an amber «!» and stays a little longer. `trigger` is the
 * action state object — each new result shows the toast again, even with the same text. Inside an open modal `dialog` pass
 * it as `container`: the top layer covers everything in `body`.
 */
export function ActionToast({ message, trigger, tone = 'success', container = null }: { message: string | undefined; trigger: object; tone?: 'success' | 'error'; container?: HTMLElement | null }) {
  const [shown, setShown] = useState<{ message: string; trigger: object } | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [previous, setPrevious] = useState(trigger);
  if (previous !== trigger) {
    setPrevious(trigger);
    if (message) { setShown({ message, trigger }); setLeaving(false); }
  }

  useEffect(() => {
    if (!shown) return;
    const stay = tone === 'error' ? TOAST_MS + 1400 : TOAST_MS;
    const leave = window.setTimeout(() => setLeaving(true), stay);
    const remove = window.setTimeout(() => setShown(null), stay + TOAST_LEAVE_MS);
    return () => { window.clearTimeout(leave); window.clearTimeout(remove); };
  }, [shown, tone]);

  if (!shown || typeof document === 'undefined') return null;
  const error = tone === 'error';
  return createPortal(<div className={`action-toast${error ? ' is-error' : ''}${leaving ? ' is-leaving' : ''}`} role={error ? 'alert' : 'status'} aria-live={error ? 'assertive' : 'polite'}>
    <svg className="action-toast-check" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      {error ? <path d="M12 7.5v5.2M12 16.4v.1" /> : <path d="m7.5 12.4 3 3 6-6.4" />}
    </svg>
    <span>{shown.message}</span>
    <button type="button" aria-label="Закрыть уведомление" onClick={() => setLeaving(true)}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
    </button>
  </div>, container ?? document.body);
}
