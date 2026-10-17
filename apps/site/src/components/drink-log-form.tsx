'use client';
import { useActionState, useState } from 'react';
import Image from 'next/image';
import { addDrinkAction, type DrinkActionState } from '@/app/profile/calendar-actions';
import { StoreDrinkPicker } from '@/components/store-drink-picker';
import type { StoreDrinkOption } from '@/lib/store-catalog';

type Drink = { name: string; brand?: string; flavor?: string; cover?: string };
const NOTHING_TAKEN = new Set<string>();

/** Adds one can: a catalog drink or the member's own, optional price and store, today or yesterday. */
export function DrinkLogForm({ options, stores, today, yesterday }: { options: StoreDrinkOption[]; stores: string[]; today: string; yesterday: string }) {
  const [state, action, pending] = useActionState<DrinkActionState, FormData>(addDrinkAction, {});
  const [drink, setDrink] = useState<Drink | null>(null);
  const [price, setPrice] = useState('');
  const [store, setStore] = useState('');
  // A fresh result clears the form only after a success; errors keep what was typed.
  const [handled, setHandled] = useState(state.at);
  if (state.at !== handled) { setHandled(state.at); if (state.success) { setDrink(null); setPrice(''); setStore(''); } }
  return <form className="drink-log-form" action={action}>
    <div className="drink-log-field">
      <label htmlFor="drink-log-name">Энергетик</label>
      {drink ? <div className="drink-log-chosen">
        {drink.cover ? <Image src={drink.cover} width={40} height={40} alt="" /> : <span className="store-drink-cover store-drink-cover-add" aria-hidden="true">⚡</span>}
        <span><strong>{drink.name}</strong><small>{drink.brand ? 'Из каталога' : 'Свой напиток'}</small></span>
        <button type="button" className="community-button community-button-text" onClick={() => setDrink(null)}>Изменить</button>
        <input type="hidden" name="name" value={drink.name} />
        {drink.brand && drink.flavor && <><input type="hidden" name="brand" value={drink.brand} /><input type="hidden" name="flavor" value={drink.flavor} /></>}
      </div> : <StoreDrinkPicker id="drink-log-name" options={options} taken={NOTHING_TAKEN} disabled={pending}
        onAdd={chosen => setDrink({ ...chosen, cover: options.find(option => option.brand === chosen.brand && option.flavor === chosen.flavor)?.cover })} />}
    </div>
    <fieldset className="drink-log-days">
      <legend>Когда</legend>
      <label><input type="radio" name="day" value={today} defaultChecked /> Сегодня</label>
      <label><input type="radio" name="day" value={yesterday} /> Вчера</label>
    </fieldset>
    <div className="drink-log-row">
      <div className="drink-log-field">
        <label htmlFor="drink-log-price">Цена, ₽ <span>необязательно</span></label>
        <input id="drink-log-price" name="price" inputMode="decimal" autoComplete="off" placeholder="129" maxLength={10} value={price} onChange={event => setPrice(event.target.value)} />
      </div>
      <div className="drink-log-field">
        <label htmlFor="drink-log-store">Магазин <span>необязательно</span></label>
        <input id="drink-log-store" name="store" list="drink-log-stores" autoComplete="off" placeholder="Пятёрочка у дома" maxLength={80} value={store} onChange={event => setStore(event.target.value)} />
        <datalist id="drink-log-stores">{stores.map(item => <option key={item} value={item} />)}</datalist>
      </div>
    </div>
    <div className="drink-log-submit">
      <button className="community-button" type="submit" disabled={pending || !drink}>{pending ? 'Сохраняем…' : 'Отметить'}</button>
      <p role="status" aria-live="polite" className={state.error ? 'drink-log-error' : 'drink-log-success'}>{state.error ?? state.success ?? ''}</p>
    </div>
  </form>;
}
