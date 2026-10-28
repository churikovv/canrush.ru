'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { loadSupportAction, readSupportAction, readSupportStaffAction, replySupportAction, sendSupportAction, setSupportStatusAction } from '@/app/support/actions';
import type { SupportMessage, SupportThread } from '@/lib/support';
import { SUPPORT_TEXT_LIMIT } from '@/lib/support-limits';

const TIME = { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit' } as const;
const DAY = { timeZone: 'Europe/Moscow', day: 'numeric', month: 'long' } as const;
const moscowDay = (iso: string) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' });
function dayLabel(iso: string): string {
  const day = moscowDay(iso), today = moscowDay(new Date().toISOString());
  const yesterday = moscowDay(new Date(Date.now() - 86_400_000).toISOString());
  return day === today ? 'Сегодня' : day === yesterday ? 'Вчера' : new Date(iso).toLocaleDateString('ru-RU', DAY);
}
const merge = (list: SupportMessage[]) => [...new Map(list.map(item => [item.id, item])).values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));

/**
 * «Помощь»: the chat with the CanRush team, built like an order's chat (market.css: `market-chat`, `market-message`,
 * `market-compose`) without photos. The member's side (`staff` false) talks about their own thread; the team's side
 * (`staff`, with `threadId`) answers one member. It polls every five seconds while visible and marks what it showed
 * as read — for the member that also reads the «Поддержка ответила» notifications.
 */
export function SupportChat({ staff = false, threadId, initial, header, empty }: {
  staff?: boolean; threadId?: string; initial: { thread: SupportThread | null; items: SupportMessage[]; hasMore: boolean };
  header?: ReactNode; empty?: ReactNode;
}) {
  const [messages, setMessages] = useState(initial.items);
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [connection, setConnection] = useState('');
  const [olderBusy, setOlderBusy] = useState(false);
  const [pending, start] = useTransition();
  const busy = useRef(false);
  const body = useRef<HTMLDivElement>(null);
  const form = useRef<HTMLFormElement>(null);
  // The messages scroll inside the chat. It opens on the newest one and follows new ones while the reader is at the
  // bottom; loading older messages keeps the line they were reading in place.
  const stick = useRef(true);
  const anchor = useRef<number | null>(null);
  const last = messages.at(-1)?.id;
  useLayoutEffect(() => {
    const element = body.current;
    if (!element) return;
    if (anchor.current !== null) { element.scrollTop = element.scrollHeight - anchor.current; anchor.current = null; }
    else if (stick.current) element.scrollTop = element.scrollHeight;
  }, [last, messages.length]);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const result = await loadSupportAction(threadId);
      if ('error' in result) { setConnection(result.error); return; }
      setConnection('');
      setMessages(previous => merge([...previous, ...result.items]));
      if (document.visibilityState === 'visible') await (staff && threadId ? readSupportStaffAction(threadId) : readSupportAction());
    } catch { setConnection('Нет соединения. Сообщения обновятся, когда связь вернётся.'); }
    finally { busy.current = false; }
  }, [staff, threadId]);
  useEffect(() => {
    const first = setTimeout(() => { void refresh(); }, 0);
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 5000);
    const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', visible);
    return () => { clearTimeout(first); clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, [refresh]);

  async function older() {
    if (!messages[0]) return;
    if (body.current) anchor.current = body.current.scrollHeight - body.current.scrollTop;
    setOlderBusy(true);
    try {
      const result = await loadSupportAction(threadId, messages[0].id);
      if ('error' in result) { anchor.current = null; setError(result.error); }
      else { setHasMore(result.hasMore); setMessages(previous => merge([...result.items, ...previous])); }
    } catch { anchor.current = null; setError('Не удалось загрузить сообщения.'); }
    finally { setOlderBusy(false); }
  }

  const canSend = !pending && Boolean(text.trim());
  return <section className="market-chat support-chat" aria-label={staff ? 'Переписка с участником' : 'Чат с поддержкой'}>
    {header}
    <div ref={body} className="market-chat-body" data-no-pull
      onScroll={event => { const element = event.currentTarget; stick.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80; }}>
      {connection && <p className="market-error" role="status">{connection} <button className="market-text-button" onClick={() => void refresh()}>Обновить</button></p>}
      {hasMore && <button className="market-text-button market-chat-older" disabled={olderBusy} onClick={() => void older()}>{olderBusy ? 'Загружаем…' : 'Показать предыдущие сообщения'}</button>}
      {messages.length ? <ol className="market-messages" aria-label="Переписка">{messages.map((item, index) => {
        const previous = messages[index - 1];
        const own = staff ? item.fromStaff : !item.fromStaff;
        return <li key={item.id} className={own ? 'market-message own' : 'market-message'}>
          {(!previous || moscowDay(previous.createdAt) !== moscowDay(item.createdAt)) && <span className="market-message-day">{dayLabel(item.createdAt)}</span>}
          <div className="market-message-bubble">
            <span className="sr-only">{own ? 'Вы' : item.fromStaff ? 'Поддержка' : item.author ?? 'Участник'}: </span>
            {staff && item.fromStaff && <small className="support-message-author">{item.author === 'Поддержка CanRush' ? 'Команда' : item.author}</small>}
            <p>{item.text}</p>
            <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleTimeString('ru-RU', TIME)}</time>
          </div>
        </li>;
      })}</ol> : empty}
    </div>
    {error && <p className="market-error" role="alert">{error}</p>}
    <form ref={form} className="market-compose" onSubmit={event => {
      event.preventDefault();
      if (!canSend) return;
      setError('');
      start(async () => {
        try {
          const result = staff && threadId ? await replySupportAction(threadId, text) : await sendSupportAction(text);
          if (result.error) setError(result.error);
          else { stick.current = true; setText(''); await refresh(); }
        } catch { setError('Сообщение не отправлено. Текст остался в поле.'); }
      });
    }}>
      <div className="market-compose-row">
        <label className="market-compose-field"><span className="sr-only">Сообщение</span>
          <textarea value={text} onChange={event => setText(event.target.value)} maxLength={SUPPORT_TEXT_LIMIT} rows={1} disabled={pending}
            placeholder={staff ? 'Ответ участнику' : 'Опишите вопрос или проблему'}
            onKeyDown={event => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); form.current?.requestSubmit(); } }} />
        </label>
        <button type="submit" className="market-compose-send" aria-label={pending ? 'Отправляем' : 'Отправить сообщение'} disabled={!canSend}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
        </button>
      </div>
    </form>
  </section>;
}

/** The team closes a solved thread or opens it again (the member's next message reopens it anyway). */
export function SupportStatusButton({ threadId, status }: { threadId: string; status: 'open' | 'closed' }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const next = status === 'open' ? 'closed' : 'open';
  return <>
    <button type="button" className="bc-button is-outline" disabled={pending} onClick={() => start(async () => {
      const result = await setSupportStatusAction(threadId, next); if (result.error) setError(result.error);
    })}>{pending ? 'Сохраняем…' : status === 'open' ? 'Закрыть обращение' : 'Открыть снова'}</button>
    {error && <span className="market-error" role="alert">{error}</span>}
  </>;
}
