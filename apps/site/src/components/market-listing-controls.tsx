'use client';
import { useState, useTransition } from 'react';
import Link from '@/components/navigation-progress';
import { useRouter } from 'next/navigation';
import { listingAction } from '@/app/market/actions';
import { formatPrice } from '@/lib/market-fields';
export function MarketListingControls({ id, own, closed, authenticated, available, unitPrice, activeOrderId, compact = false }: { id: string; own: boolean; closed: boolean; authenticated: boolean; available: number; unitPrice: number; activeOrderId?: string; compact?: boolean }) {
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [choosing, setChoosing] = useState(!compact);
  const [quantity, setQuantity] = useState('1');
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const count = Number(quantity);
  const valid = /^\d+$/.test(quantity) && Number.isSafeInteger(count) && count >= 1 && count <= available;
  if (activeOrderId) return <Link className="community-button" href={`/messages/${activeOrderId}`}>Открыть заказ</Link>;
  if (closed) return <span className="market-status">Объявление закрыто</span>;
  if (!own && available === 0) return <span className="market-status">Нет в наличии</span>;
  if (!authenticated) return <Link href="/sign-in" className="community-button">Войти и заказать</Link>;
  return <div className="market-listing-controls">
    {!own && choosing && <div className="market-order-quantity"><label>Количество для заказа<input type="number" inputMode="numeric" min={1} max={available} step={1} value={quantity} disabled={pending} onChange={event => setQuantity(event.target.value)} /></label><span aria-live="polite">{valid ? `Итого: ${formatPrice(unitPrice * count)}` : `Выберите от 1 до ${available} шт.`}</span></div>}
    <button className={`community-button${own ? ' community-button-secondary' : ''}`} disabled={pending || (!own && choosing && !valid)} onClick={() => {
      if (own && !confirm) { setConfirm(true); return; }
      if (!own && !choosing) { setChoosing(true); return; }
      setError(''); startTransition(async () => {
        try { const result = await listingAction(id, own ? 'close' : 'order', own ? 1 : count); if (result.error) setError(result.error); else if (result.id) router.push(`/messages/${result.id}`); else router.refresh(); }
        catch { setError('Не удалось выполнить действие. Проверьте соединение.'); }
      });
    }}>{pending ? 'Подождите…' : own ? confirm ? 'Подтвердить закрытие' : 'Закрыть объявление' : 'Заказать'}</button>
    {confirm && <button type="button" className="market-text-button" onClick={() => setConfirm(false)} disabled={pending}>Не закрывать</button>}
    {error && <p role="alert" className="market-error">{error}</p>}
  </div>;
}
