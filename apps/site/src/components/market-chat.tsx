'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import Link from '@/components/navigation-progress';
import type { MarketMessage, MarketOrder } from '@/lib/market';
import { ORDER_STATUS, DELIVERY, formatPrice, type OrderStatus } from '@/lib/market-fields';
import { loadMessagesAction, orderStatusAction, readMessagesAction, sendMessageAction } from '@/app/market/actions';
import { MarketPhotoPicker } from './market-photo-picker';

export function MarketChat({ initialOrder, initialMessages, initialHasMore, userId, blocked }: { initialOrder: MarketOrder; initialMessages: MarketMessage[]; initialHasMore: boolean; userId: string; blocked: boolean }) {
  const [order, setOrder] = useState(initialOrder);
  const [messages, setMessages] = useState(initialMessages);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photosBusy, setPhotosBusy] = useState(false);
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
  const active = order.status === 'new' || order.status === 'confirmed';
  return <div className="market-chat">
    <header className="market-chat-header"><div><p>{isBuyer ? 'Продавец' : 'Покупатель'}</p><h1>{isBuyer ? order.sellerName : order.buyerName}</h1></div><span className="market-status">{ORDER_STATUS[order.status]}</span></header>
    <section className="market-order-summary" aria-label="Заказ"><Link href={`/market/${order.listingId}`}>{order.title}</Link><strong>Итого: {formatPrice(order.price)}</strong><p>{order.quantity} шт. × {formatPrice(order.unitPrice)} за банку</p><p>{order.city} · {order.delivery.map(key => DELIVERY[key]).join(', ')}</p>
      <p className="market-note">Оплата и доставка вне CanRush. Согласуйте условия в переписке. Завершение заказа не подтверждает платёж на сайте.</p>
      {!blocked && <div className="market-order-actions">
        {!isBuyer && order.status === 'new' && <button className="community-button" disabled={pending} onClick={() => changeStatus('confirmed')}>Подтвердить заказ</button>}
        {isBuyer && order.status === 'confirmed' && <button className="community-button" disabled={pending} onClick={() => setConfirmStatus('completed')}>Подтвердить получение</button>}
        {active && <button className="community-button community-button-secondary" disabled={pending} onClick={() => setConfirmStatus('cancelled')}>Отменить заказ</button>}
        {confirmStatus && <div className="market-order-confirm"><p>{confirmStatus === 'completed' ? 'Вы получили товар и хотите завершить заказ?' : 'Отменить заказ? Вернуть его в работу будет нельзя.'}</p><button className="community-button" disabled={pending} onClick={() => changeStatus(confirmStatus)}>{confirmStatus === 'completed' ? 'Да, товар получен' : 'Да, отменить заказ'}</button><button className="market-text-button" disabled={pending} onClick={() => setConfirmStatus(null)}>Назад</button></div>}
      </div>}
    </section>
    {connectionError && <p className="market-error" role="status">{connectionError} <button className="market-text-button" onClick={() => void refresh()}>Обновить</button></p>}
    {hasMore && <button className="market-text-button" disabled={loadingOlder} onClick={() => void older()}>{loadingOlder ? 'Загружаем…' : 'Предыдущие сообщения'}</button>}
    <ol className="market-messages" aria-label="Переписка">{messages.map(message => <li key={message.id} className={message.senderId === userId ? 'market-message own' : 'market-message'}>
      <strong>{message.senderId === userId ? 'Вы' : isBuyer ? order.sellerName : order.buyerName}</strong>
      {message.text && <p>{message.text}</p>}
      {message.photos.length > 0 && <div className="market-message-photos">{message.photos.map((id, index) => <a href={`/api/market-photos/${id}`} key={id} target="_blank" rel="noreferrer" aria-label={`Открыть фотографию ${index + 1}`}><Image src={`/api/market-photos/${id}?size=thumbnail`} alt={`Вложение ${index + 1}`} width={200} height={200} unoptimized /></a>)}</div>}
      <time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} МСК</time>
    </li>)}</ol>
    {!messages.length && <p className="market-empty">Заказ создан. Обсудите наличие, способ доставки и оплату.</p>}
    <div ref={bottom} />
    {error && <p className="market-error" role="alert">{error}</p>}
    {blocked ? <p>Отправка сообщений для этого аккаунта ограничена.</p> : <form className="market-compose" onSubmit={event => {
      event.preventDefault();
      if (pending || photosBusy) return;
      setError('');
      const form = new FormData(); form.set('text', text); photos.forEach(photo => form.append('photos', photo));
      startTransition(async () => {
        try {
          const result = await sendMessageAction(orderId, form);
          if (result.error) setError(result.error);
          else { setText(''); setPhotos([]); setPickerKey(value => value + 1); await refresh(); bottom.current?.scrollIntoView({ block: 'nearest' }); }
        } catch { setError('Сообщение не отправлено. Текст и фотографии сохранены в форме.'); }
      });
    }}>
      <label>Сообщение<textarea value={text} onChange={event => setText(event.target.value)} maxLength={4000} rows={3} disabled={pending} placeholder="Напишите продавцу или покупателю" /></label>
      <details><summary>Прикрепить фотографии{photos.length ? ` (${photos.length})` : ''}</summary><MarketPhotoPicker key={pickerKey} onChange={setPhotos} onBusyChange={setPhotosBusy} disabled={pending} crop={false} /></details>
      <button className="community-button" type="submit" disabled={pending || photosBusy || (!text.trim() && !photos.length)}>{pending ? 'Отправляем…' : 'Отправить сообщение'}</button>
    </form>}
  </div>;
}
