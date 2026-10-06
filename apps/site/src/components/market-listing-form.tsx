'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MarketPhotoPicker } from './market-photo-picker';
import { DELIVERY } from '@/lib/market-fields';
import { createListingAction } from '@/app/market/actions';

export function MarketListingForm() {
  const [photos, setPhotos] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [photosBusy, setPhotosBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return <form className="market-form" onSubmit={event => {
    event.preventDefault();
    if (pending || photosBusy) return;
    const data = new FormData(event.currentTarget);
    if (!photos.length) { setError('Добавьте хотя бы одну фотографию.'); return; }
    photos.forEach(photo => data.append('photos', photo));
    setError(''); startTransition(async () => {
      try { const result = await createListingAction(data); if (result.id) router.push(`/market/${result.id}`); else setError(result.error ?? 'Не удалось опубликовать объявление.'); }
      catch { setError('Не удалось отправить объявление. Проверьте соединение.'); }
    });
  }}>
    <fieldset disabled={pending}>
      <MarketPhotoPicker onChange={setPhotos} onBusyChange={setPhotosBusy} disabled={pending} />
      <label>Название<input name="title" required maxLength={120} placeholder="Например, Monster из Японии" /></label>
      <label>Описание<textarea name="description" required maxLength={5000} rows={6} placeholder="Какие напитки продаёте, количество, состояние и сроки годности" /></label>
      <fieldset className="market-delivery"><legend>Способы доставки</legend>{Object.entries(DELIVERY).map(([value, label]) => <label key={value}><input type="checkbox" name="delivery" value={value} />{label}</label>)}</fieldset>
      <label>Город<input name="city" required maxLength={100} autoComplete="address-level2" placeholder="Москва" /></label>
      <div className="market-form-row"><label>Количество в наличии, шт.<input name="quantity" type="number" required min={1} max={100000} step={1} inputMode="numeric" placeholder="6" /></label><label>Цена за одну банку, ₽<input name="price" required inputMode="decimal" maxLength={12} placeholder="1200" /></label></div>
      <p className="market-note">Покупатель выбирает количество. Новый заказ резервирует банки, отмена возвращает их в продажу.</p>
    </fieldset>
    <p className="market-note">Оплату и доставку вы согласуете с покупателем в переписке. CanRush не принимает платежи и не оформляет доставку.</p>
    {error && <p className="market-error" role="alert">{error}</p>}
    <button className="community-button" disabled={pending || photosBusy} type="submit">{pending ? 'Публикуем…' : 'Опубликовать объявление'}</button>
  </form>;
}
