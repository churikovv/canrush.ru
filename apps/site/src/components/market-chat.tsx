'use client';

import { useCallback, useEffect, useRef, useState, useTransition, type CSSProperties } from 'react';
import Image from 'next/image';
import Link from '@/components/navigation-progress';
import type { MarketMessage, MarketOrder } from '@/lib/market';
import { ORDER_STATUS, ORDER_STEPS, DELIVERY, formatPrice, orderNextStep, orderStepIndex, type OrderStatus } from '@/lib/market-fields';
import { loadMessagesAction, orderStatusAction, readMessagesAction, sendMessageAction } from '@/app/market/actions';
import { MarketPhotoPicker } from './market-photo-picker';

const TIME = { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit' } as const;
const DAY = { timeZone: 'Europe/Moscow', day: 'numeric', month: 'long' } as const;
const moscowDay = (iso: string) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' });

function dayLabel(iso: string): string {
  const day = moscowDay(iso), today = moscowDay(new Date().toISOString());
  const yesterday = moscowDay(new Date(Date.now() - 86_400_000).toISOString());
  return day === today ? 'Сегодня' : day === yesterday ? 'Вчера' : new Date(iso).toLocaleDateString('ru-RU', DAY);
}

function AttachIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m21 11.5-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8l8.6-8.6a3.7 3.7 0 0 1 5.2 5.2l-8.6 8.6a1.8 1.8 0 0 1-2.6-2.6l7.9-7.9" /></svg>;
}
function SendIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>;
}

export function MarketChat({ initialOrder, initialMessages, initialHasMore, userId, blocked }: { initialOrder: MarketOrder; initialMessages: MarketMessage[]; initialHasMore: boolean; userId: string; blocked: boolean }) {
  const [order, setOrder] = useState(initialOrder);
  const [messages, setMessages] = useState(initialMessages);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photosBusy, setPhotosBusy] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [text, setText] = useState('');
  const [pickerKey, setPickerKey] = useState(0);
  const [error, setError] = useState('');
  const [connectionError, setConnectionError] = useState('');
  const [pending, startTransition] = useTransition();
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState<OrderStatus | null>(null);
  const busy = useRef(false);
  const latestReceived = useRef(initialMessages.at(-1)?.id);
  const bottom = useRef<HTMLDivElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const orderId = order.id;
  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const result = await loadMessagesAction(orderId);
      if ('error' in result) { setConnectionError(result.error ?? 'Не удалось обновить сообщения.'); return; }
      setConnectionError(''); setOrder(result.order);
      if (result.hasMore && !result.items.some(item => item.id === latestReceived.current)) {
        setMessages(result.items); setHasMore(true);
      } else setMessages(previous => [...new Map([...previous, ...result.items].map(item => [item.id, item])).values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)));
      latestReceived.current = result.items.at(-1)?.id;
      if (document.visibilityState === 'visible' && result.items.at(-1)) await readMessagesAction(orderId, result.items.at(-1)!.id);
    } catch { setConnectionError('Нет соединения. Сообщения обновятся после восстановления связи.'); }
    finally { busy.current = false; }
  }, [orderId]);
  useEffect(() => {
    const initialRefresh = setTimeout(() => { void refresh(); }, 0);
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 5000);
    const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', visible);
    return () => { clearTimeout(initialRefresh); clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, [refresh]);
  async function older() {
    if (!messages[0]) return;
    setLoadingOlder(true);
    try {
      const result = await loadMessagesAction(orderId, messages[0].id);
      if ('error' in result) setError(result.error ?? 'Не удалось загрузить сообщения.');
      else { setHasMore(result.hasMore); setMessages(previous => [...new Map([...result.items, ...previous].map(item => [item.id, item])).values()]); }
    } catch { setError('Не удалось загрузить сообщения.'); }
    finally { setLoadingOlder(false); }
  }
  function changeStatus(status: OrderStatus) {
    setError(''); startTransition(async () => {
      try { const result = await orderStatusAction(orderId, status); if (result.error) setError(result.error); else { setConfirmStatus(null); await refresh(); } }
      catch { setError('Не удалось изменить статус.'); }
    });
  }
  const isBuyer = order.buyerId === userId;
  const role = isBuyer ? 'buyer' : 'seller';
  const partner = isBuyer ? { name: order.sellerName, username: order.sellerUsername } : { name: order.buyerName, username: order.buyerUsername };
  const active = order.status === 'new' || order.status === 'confirmed';
  const step = orderStepIndex(order.status);
  const canSend = !pending && !photosBusy && Boolean(text.trim() || photos.length);

  const summary = <aside className="market-order-card" aria-label="Заказ" data-status={order.status}>
    <Link className="market-order-listing" href={`/market/${order.listingId}`}>
      <span className="market-order-photo">{order.photoId ? <Image src={`/api/market-photos/${order.photoId}?size=thumbnail`} alt="" width={72} height={72} unoptimized /> : <span aria-hidden="true">?</span>}</span>
      <span className="market-order-title"><small>Объявление{order.closed ? ' · в архиве' : ''}</small><strong>{order.title}</strong></span>
    </Link>
    <div className="market-order-section market-order-state">
      <div className="market-order-section-head"><h2>Статус</h2><span className="market-order-status" data-status={order.status}>{ORDER_STATUS[order.status]}</span></div>
      {order.status !== 'cancelled' && <ol className="market-order-steps" aria-label="Этапы заказа" style={{ '--order-step': step } as CSSProperties}>
        {ORDER_STEPS.map((item, index) => <li key={item.key} data-done={index <= step || undefined} aria-current={index === step ? 'step' : undefined}><span aria-hidden="true" />{item.label}</li>)}
      </ol>}
      <p className="market-order-next">{orderNextStep(order.status, role)}</p>
    </div>
    <dl className="market-order-section market-order-numbers">
      <div><dt>Количество</dt><dd>{order.quantity} шт.</dd></div>
      <div><dt>Цена за банку</dt><dd>{formatPrice(order.unitPrice)}</dd></div>
      <div className="is-total"><dt>Итого</dt><dd>{formatPrice(order.price)}</dd></div>
    </dl>
    <div className="market-order-section">
      <div className="market-order-section-head"><h2>Получение</h2><span className="market-order-city">{order.city}</span></div>
      <div className="market-order-delivery">{order.delivery.map(key => <span key={key} className="market-order-chip">{DELIVERY[key]}</span>)}</div>
    </div>
    {!blocked && active && <div className="market-order-actions">
      {confirmStatus ? <div className="market-order-confirm" role="group" aria-label="Подтверждение">
        <p>{confirmStatus === 'completed' ? 'Вы получили банки и хотите завершить заказ?' : 'Отменить заказ? Вернуть его в работу будет нельзя.'}</p>
        <button className={`community-button${confirmStatus === 'cancelled' ? ' market-danger-button' : ''}`} disabled={pending} onClick={() => changeStatus(confirmStatus)}>{confirmStatus === 'completed' ? 'Да, банки получены' : 'Да, отменить заказ'}</button>
        <button className="community-button community-button-secondary" disabled={pending} onClick={() => setConfirmStatus(null)}>Назад</button>
      </div> : <>
        {!isBuyer && order.status === 'new' && <button className="community-button" disabled={pending} onClick={() => changeStatus('confirmed')}>Подтвердить заказ</button>}
        {isBuyer && order.status === 'confirmed' && <button className="community-button" disabled={pending} onClick={() => setConfirmStatus('completed')}>Подтвердить получение</button>}
        <button className="community-button market-order-cancel" disabled={pending} onClick={() => setConfirmStatus('cancelled')}>Отменить заказ</button>
      </>}
    </div>}
    <p className="market-order-note">Оплата и доставка — вне CanRush. Завершение заказа не подтверждает платёж на сайте.</p>
  </aside>;

  return <div className="market-order-page">
    {summary}
    <section className="market-chat" aria-labelledby="market-chat-partner">
      <header className="market-chat-header">
        <span className="market-seller-avatar" aria-hidden="true">{partner.name.slice(0, 1).toLocaleUpperCase('ru-RU')}</span>
        <span className="market-chat-partner"><small>{isBuyer ? 'Продавец' : 'Покупатель'}</small>
          <h1 id="market-chat-partner">{partner.username ? <Link href={`/profile/${partner.username}`}>{partner.name}</Link> : partner.name}</h1></span>
      </header>
      <div className="market-chat-body">
        {connectionError && <p className="market-error" role="status">{connectionError} <button className="market-text-button" onClick={() => void refresh()}>Обновить</button></p>}
        {hasMore && <button className="market-text-button market-chat-older" disabled={loadingOlder} onClick={() => void older()}>{loadingOlder ? 'Загружаем…' : 'Показать предыдущие сообщения'}</button>}
        {messages.length ? <ol className="market-messages" aria-label="Переписка">{messages.map((message, index) => {
          const previous = messages[index - 1];
          const separator = !previous || moscowDay(previous.createdAt) !== moscowDay(message.createdAt);
          const own = message.senderId === userId;
          return <li key={message.id} className={own ? 'market-message own' : 'market-message'}>
            {separator && <span className="market-message-day">{dayLabel(message.createdAt)}</span>}
            <div className="market-message-bubble">
              <span className="sr-only">{own ? 'Вы' : partner.name}: </span>
              {message.text && <p>{message.text}</p>}
              {message.photos.length > 0 && <div className="market-message-photos">{message.photos.map((id, index) => <a href={`/api/market-photos/${id}`} key={id} target="_blank" rel="noreferrer" aria-label={`Открыть фотографию ${index + 1}`}><Image src={`/api/market-photos/${id}?size=thumbnail`} alt={`Вложение ${index + 1}`} width={200} height={200} unoptimized /></a>)}</div>}
              <time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleTimeString('ru-RU', TIME)}</time>
            </div>
          </li>;
        })}</ol> : <div className="market-chat-empty"><strong>Заказ создан</strong><p>{isBuyer ? 'Напишите продавцу: как удобнее получить банки и как оплатить.' : 'Напишите покупателю, когда и как передадите банки.'}</p></div>}
        <div ref={bottom} />
      </div>
      {error && <p className="market-error" role="alert">{error}</p>}
      {blocked ? <p className="market-chat-blocked">Отправка сообщений для этого аккаунта ограничена.</p> : <form ref={form} className="market-compose" onSubmit={event => {
        event.preventDefault();
        if (!canSend) return;
        setError('');
        const data = new FormData(); data.set('text', text); photos.forEach(photo => data.append('photos', photo));
        startTransition(async () => {
          try {
            const result = await sendMessageAction(orderId, data);
            if (result.error) setError(result.error);
            else { setText(''); setPhotos([]); setAttaching(false); setPickerKey(value => value + 1); await refresh(); bottom.current?.scrollIntoView({ block: 'nearest' }); }
          } catch { setError('Сообщение не отправлено. Текст и фотографии сохранены в форме.'); }
        });
      }}>
        {attaching && <div className="market-compose-photos"><MarketPhotoPicker key={pickerKey} onChange={setPhotos} onBusyChange={setPhotosBusy} disabled={pending} crop={false} compact /></div>}
        <div className="market-compose-row">
          <button type="button" className="market-compose-icon" aria-label="Прикрепить фотографии" aria-expanded={attaching} data-count={photos.length || undefined} disabled={pending} onClick={() => setAttaching(value => !value)}><AttachIcon /></button>
          <label className="market-compose-field"><span className="sr-only">Сообщение</span>
            <textarea value={text} onChange={event => setText(event.target.value)} maxLength={4000} rows={1} disabled={pending} placeholder={isBuyer ? 'Сообщение продавцу' : 'Сообщение покупателю'}
              onKeyDown={event => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); form.current?.requestSubmit(); } }} />
          </label>
          <button type="submit" className="market-compose-send" aria-label={pending ? 'Отправляем' : 'Отправить сообщение'} disabled={!canSend}><SendIcon /></button>
        </div>
      </form>}
    </section>
  </div>;
}
