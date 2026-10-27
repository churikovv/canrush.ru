'use client';
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Link from '@/components/navigation-progress';

/**
 * The cabinet's client bits: the phone drawer (the sidebar slides in over the page), ⌘K / Ctrl+K to the search, and
 * toolbar dropdowns (`details.bc-dropdown`) closing on a click outside or Escape.
 */
export function BusinessFrame({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setOpen(true); document.querySelector<HTMLInputElement>('.bc-search input[name="q"]')?.focus(); }
      if (event.key === 'Escape') { setOpen(false); document.querySelectorAll('details.bc-dropdown[open]').forEach(item => item.removeAttribute('open')); }
    };
    const outside = (event: PointerEvent) => document.querySelectorAll('details.bc-dropdown[open]').forEach(item => { if (!item.contains(event.target as Node)) item.removeAttribute('open'); });
    document.addEventListener('keydown', keys);
    document.addEventListener('pointerdown', outside);
    return () => { document.removeEventListener('keydown', keys); document.removeEventListener('pointerdown', outside); };
  }, []);
  return <div className="bc-root" data-nav-open={open || undefined}>
    <div className="bc-sidebar-wrap" onClick={event => { if ((event.target as HTMLElement).closest('a')) setOpen(false); }}>{sidebar}</div>
    <button type="button" className="bc-scrim" aria-label="Закрыть меню" tabIndex={open ? 0 : -1} onClick={() => setOpen(false)} />
    <div className="bc-main">
      <button type="button" className="bc-burger" aria-label="Меню кабинета" aria-expanded={open} onClick={() => setOpen(true)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </button>
      {children}
    </div>
  </div>;
}

/**
 * The «⋯» menu of a table row. The panel is portalled to `body` with fixed coordinates taken from the button, so a
 * table's rounded clipping or a neighbouring row never hides it and the row does not move. Opens to the left, flips
 * up near the bottom; Escape, a click outside, scrolling or choosing an item closes it.
 */
export function BusinessRowMenu({ label, items }: { label: string; items: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState<{ top: number; right: number; up: boolean } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  useLayoutEffect(() => {
    if (!open || !button.current) return;
    const rect = button.current.getBoundingClientRect();
    const up = window.innerHeight - rect.bottom < 160;
    setAt({ top: up ? rect.top - 6 : rect.bottom + 6, right: Math.max(8, window.innerWidth - rect.right), up });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>('a')?.focus();
    const close = (event: Event) => { if (event.type !== 'pointerdown' || (!panel.current?.contains(event.target as Node) && !button.current?.contains(event.target as Node))) setOpen(false); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); button.current?.focus(); } };
    document.addEventListener('pointerdown', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', close); window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); document.removeEventListener('keydown', key); };
  }, [open]);
  return <>
    <button ref={button} type="button" className="bc-icon-button bc-row-menu-button" aria-label={label} title={label} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(value => !value)}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>
    </button>
    {open && at && createPortal(<div ref={panel} id={id} role="menu" aria-label={label} className="bc-row-menu"
      style={{ top: at.up ? undefined : at.top, bottom: at.up ? window.innerHeight - at.top : undefined, right: at.right }}>
      {items.map(item => <Link key={item.href} role="menuitem" href={item.href} onClick={() => setOpen(false)}>{item.label}</Link>)}
    </div>, document.body)}
  </>;
}
