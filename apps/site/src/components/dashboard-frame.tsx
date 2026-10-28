'use client';
import { useEffect, useState, type ReactNode } from 'react';

/**
 * The dashboard's client bits (cabinet and admin): the phone drawer (the sidebar slides in over the page), ⌘K / Ctrl+K to the search, and
 * toolbar dropdowns (`details.bc-dropdown`) closing on a click outside or Escape.
 */
export function DashboardFrame({ sidebar, className, menuLabel = 'Меню кабинета', children }: { sidebar: ReactNode; className?: string; menuLabel?: string; children: ReactNode }) {
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
  return <div className={className ? `bc-root ${className}` : 'bc-root'} data-nav-open={open || undefined}>
    <div className="bc-sidebar-wrap" onClick={event => { if ((event.target as HTMLElement).closest('a')) setOpen(false); }}>{sidebar}</div>
    <button type="button" className="bc-scrim" aria-label="Закрыть меню" tabIndex={open ? 0 : -1} onClick={() => setOpen(false)} />
    <div className="bc-main">
      <button type="button" className="bc-burger" aria-label={menuLabel} aria-expanded={open} onClick={() => setOpen(true)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </button>
      {children}
    </div>
  </div>;
}
