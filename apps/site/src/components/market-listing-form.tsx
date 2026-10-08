'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MarketPhotoPicker } from './market-photo-picker';
import { PriceFilterInput } from './price-filter-input';
import { DELIVERY } from '@/lib/market-fields';
import { createListingAction } from '@/app/market/actions';

export function MarketListingForm({ brands }: { brands: string[] }) {
  const [brand, setBrand] = useState('');
  const [anyCity, setAnyCity] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [photosBusy, setPhotosBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return <form className="market-form" onSubmit={event => {
    event.preventDefault();
    if (pending || photosBusy) return;
    const data = new FormData(event.currentTarget);
    if (!brand) { setError('Выберите бренд.'); return; }
    if (!photos.length) { setError('Добавьте хотя бы одну фотографию.'); return; }
    photos.forEach(photo => data.append('photos', photo));
    setError(''); startTransition(async () => {
      try { const result = await createListingAction(data); if (result.id) router.push(`/market/${result.id}`); else setError(result.error ?? 'Не удалось опубликовать объявление.'); }
      catch { setError('Не удалось отправить объявление. Проверьте соединение.'); }
    });
  }}>
    <fieldset disabled={pending}>
      <section className="market-form-section"><h2>Название</h2><label><span className="sr-only">Название объявления</span><input name="title" required maxLength={120} placeholder="Название объявления" /></label></section>
      <section className="market-form-section"><h2>Внешний вид</h2><MarketPhotoPicker compact onChange={setPhotos} onBusyChange={setPhotosBusy} disabled={pending} /></section>
      <section className="market-form-section"><h2>Характеристики</h2><label htmlFor="listing-brand">Бренд</label><PriceFilterInput id="listing-brand" value={brand} options={[...brands.map(value=>({value,label:value})),{value:'Другой',label:'Другой бренд'},{value:'Разные бренды',label:'Разные бренды'}]} allLabel="Выберите бренд" onChange={setBrand}/><input type="hidden" name="brand" value={brand}/></section>
      <section className="market-form-section"><h2>Подробности</h2><label><span className="sr-only">Описание объявления</span><textarea name="description" required maxLength={5000} rows={6} placeholder="Описание объявления" /></label></section>
      <section className="market-form-section"><h2>Условия продажи</h2>
      <div className="market-form-row"><label>Цена за одну банку, ₽<input name="price" required inputMode="decimal" maxLength={12} placeholder="1200" /></label><label>Количество, шт.<input name="quantity" type="number" required min={1} max={100000} step={1} inputMode="numeric" placeholder="6" /></label></div>
      <label className="market-any-city"><input type="checkbox" name="anyCity" checked={anyCity} onChange={event=>setAnyCity(event.target.checked)}/>Любой город</label>
      {!anyCity && <label>Город<input name="city" required maxLength={100} autoComplete="address-level2" placeholder="Москва" /></label>}
      <fieldset className="market-delivery"><legend>Способы доставки</legend>{Object.entries(DELIVERY).map(([value, label]) => <label key={value}><input type="checkbox" name="delivery" value={value} />{label}</label>)}</fieldset>
      </section>
      <p className="market-note">Покупатель выбирает количество. Новый заказ резервирует банки, отмена возвращает их в продажу.</p>
    </fieldset>
    <p className="market-note">Оплату и доставку вы согласуете с покупателем в переписке. CanRush не принимает платежи и не оформляет доставку.</p>
    {error && <p className="market-error" role="alert">{error}</p>}
    <button className="community-button" disabled={pending || photosBusy} type="submit">{pending ? 'Публикуем…' : 'Опубликовать объявление'}</button>
  </form>;
}
