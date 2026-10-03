'use client';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useNotificationIdentity } from '@/components/notification-state';
import { notificationAction } from '@/app/notifications/actions';
import type { NotificationItem } from '@/lib/notifications';

export function NotificationBell() {
  const { identity: { authenticated, unread }, setIdentity } = useNotificationIdentity();
  const [items,setItems] = useState<NotificationItem[]>([]);
  const [more,setMore] = useState(false);
  const [open,setOpen] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [warning,setWarning] = useState('');
  const inFlight = useRef(false);
  const panel = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const router = useRouter(); const pathname = usePathname(); const titleId = useId();
  const load = useCallback(async (action: 'list' | 'read' | 'read-all' = 'list', id?: string, before?: string) => {
    if(inFlight.current) return false;
    inFlight.current = true; setBusy(true); setError('');
    try {
      const result = await notificationAction(action,id,before);
      if (result.error) { setError(result.error); return false; }
      if (!result.authenticated) { setIdentity({ authenticated: false, unread: 0 }); setOpen(false); setItems([]); return false; }
      setIdentity({ authenticated: true, unread: result.unread }); setMore(result.hasMore); setWarning(result.priceWarning ?? '');
      setItems(current => before ? [...current,...result.items.filter(item => !current.some(old => old.id===item.id))] : result.items);
      return true;
    } catch { setError('Нет связи с сервером. Попробуйте ещё раз.'); return false; }
    finally { inFlight.current=false; setBusy(false); }
  },[setIdentity]);
  useEffect(() => {
    const initial = window.setTimeout(() => void load(),0);
    const refresh = () => { if(document.visibilityState==='visible' && !panel.current?.open) void load(); };
    const timer = window.setInterval(refresh,60000);
    document.addEventListener('visibilitychange',refresh);
    return () => { clearTimeout(initial); clearInterval(timer); document.removeEventListener('visibilitychange',refresh); };
  },[load,pathname]);
  useEffect(() => {
    if(!open) return;
    const dialog = panel.current; const button = trigger.current; const previous = document.body.style.overflow;
    dialog?.showModal(); document.body.style.overflow='hidden';
    return () => { dialog?.close(); document.body.style.overflow=previous; button?.focus(); };
  },[open]);
  if (!authenticated) return <span className="notification-slot" aria-hidden="true" />;
  return <>
    <button ref={trigger} type="button" className="notification-bell" aria-label={`Уведомления${unread ? `, непрочитанных: ${unread}` : ''}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => { setOpen(true); void load(); }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>
      {unread>0 && <span className="notification-count" aria-hidden="true">{unread>99?'99+':unread}</span>}
    </button>
    {open && <dialog ref={panel} className="notification-panel" aria-labelledby={titleId} onCancel={() => setOpen(false)} onClick={event => { if(event.target===event.currentTarget) { const box=event.currentTarget.getBoundingClientRect(); if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)setOpen(false); } }}>
      <header><div><h2 id={titleId}>Уведомления</h2><span>{unread ? `Непрочитанных: ${unread}` : 'Все прочитаны'}</span></div><button type="button" className="notification-close" aria-label="Закрыть уведомления" onClick={() => setOpen(false)}><svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header>
      <div className="notification-toolbar"><button type="button" disabled={busy || unread===0} onClick={() => void load('read-all')}>Прочитать все</button><button type="button" disabled={busy} onClick={() => void load()}>{busy?'Обновляем…':'Обновить'}</button></div>
      {error && <p className="field-error" role="alert">{error}</p>}{warning && <p className="field-help">{warning}</p>}
      <div className="notification-content" aria-busy={busy}>
        {!items.length ? <div className="notification-empty"><strong>Пока тихо</strong><p>Здесь появятся подписки, лайки, комментарии и изменения цен в избранном.</p></div> : <ul>{items.map(item => <li key={item.id} className={item.unread?'notification-unread':undefined}><a href={item.href} onClick={async event => { event.preventDefault(); if(await load('read',item.id)) { setOpen(false); router.push(item.href); router.refresh(); } }} aria-label={`${item.unread?'Новое: ':''}${item.title}. ${item.detail}`}><span className="notification-dot" aria-hidden="true"/><div><strong>{item.title}</strong>{item.detail && <p>{item.detail}</p>}<time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</time></div></a></li>)}</ul>}
        {more && <button type="button" className="notification-more" disabled={busy} onClick={() => void load('list',undefined,items.at(-1)?.id)}>Ещё уведомления</button>}
      </div>
    </dialog>}
  </>;
}
