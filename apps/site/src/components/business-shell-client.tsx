'use client';
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from '@/components/navigation-progress';
import { notificationAction } from '@/app/notifications/actions';
import type { NotificationItem } from '@/lib/notifications';

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

/**
 * The cabinet's bell: a panel under the button instead of the site's inbox. Opening loads the latest notifications
 * (`notificationAction`, the same as the site's bell), keeps the dots of the new ones for this opening and marks them
 * read on the server; a tap reads one and opens its page. «Все уведомления» loads the next page. Escape, a click outside
 * or scrolling the page away closes it.
 */
export function BusinessNotifications({ unread: initialUnread }: { unread: number }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // On phones the panel spans the screen (fixed), right under the bell wherever the top bar's row put it.
  const [top, setTop] = useState(72);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const id = useId();
  // A new count from the server (navigation) replaces the local one.
  const [seen, setSeen] = useState(initialUnread);
  if (seen !== initialUnread) { setSeen(initialUnread); setUnread(initialUnread); }

  async function load(before?: string) {
    setBusy(true); setError('');
    try {
      const result = await notificationAction('list', undefined, before);
      if (result.error || !result.authenticated) { setError(result.error ?? 'Войдите снова.'); return false; }
      setItems(current => before && current ? [...current, ...result.items.filter(item => !current.some(old => old.id === item.id))] : result.items);
      setMore(result.hasMore); setUnread(result.unread);
      return true;
    } catch { setError('Нет связи с сервером. Попробуйте ещё раз.'); return false; }
    finally { setBusy(false); }
  }
  async function toggle() {
    if (open) { setOpen(false); return; }
    setTop(Math.round((button.current?.getBoundingClientRect().bottom ?? 64) + 8));
    setOpen(true);
    if (!await load()) return;
    try { const result = await notificationAction('read-all'); if (!result.error && result.authenticated) setUnread(result.unread); } catch { /* the dot stays until the next opening */ }
  }
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!box.current?.contains(event.target as Node)) setOpen(false); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); button.current?.focus(); } };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', key); };
  }, [open]);

  const fresh = items?.filter(item => item.unread).length ?? 0;
  return <div className="bc-notify" ref={box}>
    <button ref={button} type="button" className="bc-icon-button" aria-label={unread ? `Уведомления: ${unread} новых` : 'Уведомления'} title="Уведомления"
      aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => void toggle()}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /></svg>
      {unread > 0 && <span className="bc-dot" aria-hidden="true" />}
    </button>
    {open && <div id={id} className="bc-notify-panel" role="dialog" aria-label="Уведомления" style={{ '--bc-notify-top': `${top}px` } as CSSProperties}>
      <header><strong>Уведомления</strong><span className="bc-muted">{items === null ? 'Загружаем…' : fresh ? `Новых: ${fresh}` : 'Новых нет'}</span></header>
      {error && <p className="bc-notify-error" role="alert">{error}</p>}
      <div className="bc-notify-list" aria-busy={busy}>
        {items?.length === 0 && <div className="bc-notify-empty"><strong>Пока тихо</strong><span className="bc-muted">Здесь появятся новые отзывы на ваши напитки, приглашения и заказы.</span></div>}
        {items && items.length > 0 && <ul>{items.map(item => <li key={item.id} data-unread={item.unread || undefined}>
          <a href={item.href} onClick={async event => {
            event.preventDefault(); setOpen(false);
            void notificationAction('read', item.id).catch(() => undefined);
            router.push(item.href);
          }}>
            <span className="bc-notify-dot" aria-hidden="true" />
            <span><strong>{item.title}</strong>{item.detail && <small>{item.detail}</small>}
              <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</time></span>
          </a>
        </li>)}</ul>}
        {more && <button type="button" className="bc-notify-more" disabled={busy} onClick={() => void load(items?.at(-1)?.id)}>{busy ? 'Загружаем…' : 'Ещё уведомления'}</button>}
      </div>
    </div>}
  </div>;
}

const ONBOARDING: Record<string, { title: string; text: string; href: string; action: string }> = {
  verified: { title: 'Компания на проверке', text: 'Команда CanRush проверит данные — обычно пару дней. Мы напишем на почту.', href: '/business/cabinet?section=settings', action: 'Данные компании' },
  logo: { title: 'Добавьте логотип', text: 'Он стоит у ответов на отзывы и у объявлений компании.', href: '/business/cabinet?section=settings&tab=profile', action: 'Загрузить' },
  drink: { title: 'Прикрепите напитки', text: 'Аналитика, ответы и сравнение считаются по подтверждённым напиткам.', href: '/business/cabinet?section=drinks', action: 'К напиткам' },
  team: { title: 'Пригласите команду', text: 'Коллеги смогут отвечать на отзывы и смотреть аналитику.', href: '/business/cabinet?section=settings&tab=team', action: 'Пригласить' },
  reply: { title: 'Ответьте на первый отзыв', text: 'Ответ компании видят все под отзывом, а автор получает уведомление.', href: '/business/cabinet?section=reviews&view=unanswered', action: 'К отзывам' },
  competitors: { title: 'Выберите конкурентов', text: 'До трёх брендов — их числа встанут рядом с вашими.', href: '/business/cabinet?section=competitors', action: 'Выбрать' },
};

/**
 * The first-steps checklist on the overview: what is done is ticked, the next step has its button. It leaves once
 * everything is done; «Скрыть» hides it in this browser (a convenience, so `localStorage`, and it shows if storage fails).
 */
export function BusinessChecklist({ businessId, steps }: { businessId: string; steps: { key: string; done: boolean }[] }) {
  const key = `canrush-business-checklist:${businessId}`;
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    let stored = false;
    try { stored = window.localStorage.getItem(key) === 'hidden'; } catch { /* shown */ }
    const timer = window.setTimeout(() => setHidden(stored), 0);
    return () => clearTimeout(timer);
  }, [key]);
  const done = steps.filter(step => step.done).length;
  if (hidden || done === steps.length) return null;
  const next = steps.find(step => !step.done)?.key;
  return <section className="bc-card bc-checklist" aria-labelledby="bc-checklist-title">
    <div className="bc-card-head">
      <div><h2 id="bc-checklist-title">Первые шаги</h2><span className="bc-muted">{done} из {steps.length} готово</span></div>
      <button type="button" className="bc-link-button is-muted" onClick={() => { setHidden(true); try { window.localStorage.setItem(key, 'hidden'); } catch { /* hidden for now */ } }}>Скрыть</button>
    </div>
    <div className="bc-checklist-bar" aria-hidden="true"><span style={{ width: `${done / steps.length * 100}%` }} /></div>
    <ol>{steps.map(step => { const item = ONBOARDING[step.key]!; return <li key={step.key} data-done={step.done || undefined} data-next={step.key === next || undefined}>
      <span className="bc-checklist-mark" aria-hidden="true">{step.done ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4.5 4.5L19 7" /></svg> : null}</span>
      <span className="bc-checklist-text"><strong>{step.done && step.key === 'verified' ? 'Компания подтверждена' : item.title}<span className="sr-only">{step.done ? ' — готово' : ''}</span></strong>{!step.done && <small className="bc-muted">{item.text}</small>}</span>
      {!step.done && step.key !== 'verified' && <Link className={`bc-button${step.key === next ? '' : ' is-outline'}`} href={item.href}>{item.action}</Link>}
    </li>; })}</ol>
  </section>;
}
