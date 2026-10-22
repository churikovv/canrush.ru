'use client';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

/**
 * «⋯» menu for a post or comment: edit, delete, report. Items are passed as children — buttons with
 * the `more-actions-item` class (or components that render one); choosing any item closes the menu.
 * The panel stays mounted while hidden, so a form inside it (delete) still submits; dialogs opened
 * from it must render outside (ContentReportButton uses a portal).
 */
export function MoreActions({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const items = () => [...(root.current?.querySelectorAll<HTMLElement>('.more-actions-item:not(:disabled)') ?? [])];

  useEffect(() => {
    if (!open) return;
    items()[0]?.focus();
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); trigger.current?.focus(); return; }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const list = items();
    const index = list.indexOf(document.activeElement as HTMLElement);
    list[(index + (event.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length]?.focus();
  }

  return <div className="more-actions" ref={root} onKeyDown={onKeyDown}>
    <button ref={trigger} className="wall-action-button more-actions-trigger" type="button" aria-label={label} title={label}
      aria-haspopup="menu" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(value => !value)}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
    </button>
    <div id={panelId} className="more-actions-panel" role="menu" aria-label={label} hidden={!open}
      onClick={event => { if ((event.target as Element).closest('.more-actions-item')) setOpen(false); }}>
      {children}
    </div>
  </div>;
}
