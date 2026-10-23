'use client';
import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import Link from '@/components/navigation-progress';
import { NavigationIcon, type NavigationIconName, type NavigationSection } from '@/components/navigation-icon';

/** `section` names the page for «current» and the icon; a menu-only item (Люди) may use an icon name. */
export interface HeaderMenuItem { section: NavigationSection | NavigationIconName; href: string; label: string; hint: string; current: boolean }

const CLOSE_DELAY_MS = 160;

/**
 * Desktop header group. The label is a link to the group's first page; hovering opens the panel of the
 * group's pages, and the chevron next to it opens the panel for keyboard and touch. Escape and a click
 * outside close it.
 */
export function HeaderMenu({ label, icon, current, items }: { label: string; icon: NavigationIconName; current: boolean; items: HeaderMenuItem[] }) {
  const first = items[0]!;
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const closing = useRef<ReturnType<typeof setTimeout>>(undefined);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  useEffect(() => () => clearTimeout(closing.current), []);

  const hover = (next: boolean) => (event: ReactPointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    clearTimeout(closing.current);
    if (next) setOpen(true); else closing.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  };

  return <div ref={root} className="header-menu" data-open={open || undefined} data-current={current || undefined} onPointerEnter={hover(true)} onPointerLeave={hover(false)}
    onBlur={event => { if (!root.current?.contains(event.relatedTarget as Node)) setOpen(false); }}>
    <Link className="profile-navigation-item header-menu-trigger" href={first.href} data-motion={first.section} onClick={() => setOpen(false)}>
      <NavigationIcon section={icon} />
      <span className="profile-navigation-label">{label}</span>
    </Link>
    <button ref={trigger} type="button" className="header-menu-toggle" aria-expanded={open} aria-controls={id} aria-label={`Разделы: ${label}`}
      onClick={event => { const pointer = (event.nativeEvent as PointerEvent).pointerType; setOpen(value => pointer === 'mouse' ? true : !value); }}>
      <svg className="header-menu-chevron" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="m3 4.5 3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
    <div id={id} className="header-menu-panel" hidden={!open}>
      <ul>{items.map(item => <li key={item.href}>
        <Link className="header-menu-link" data-motion={item.section} href={item.href} aria-current={item.current ? 'page' : undefined} onClick={() => setOpen(false)}>
          <NavigationIcon section={item.section} />
          <span><strong>{item.label}</strong><small>{item.hint}</small></span>
        </Link>
      </li>)}</ul>
    </div>
  </div>;
}
