'use client';
import { useActionState, useState, type ReactNode } from 'react';
import Image from 'next/image';
import { addDrinkAction, type DrinkActionState } from '@/app/profile/calendar-actions';
import { DrinkBird } from '@/components/drink-bird';
import { FormOptional } from '@/components/form-step';
import { StoreDrinkPicker } from '@/components/store-drink-picker';
import { days } from '@/lib/drink-calendar-fields';
import type { StoreDrinkOption } from '@/lib/store-catalog';

type Drink = { name: string; brand?: string; flavor?: string; cover?: string };
const NOTHING_TAKEN = new Set<string>();

/** One step of the form; later steps stay inert until a drink is chosen, so the order reads at a glance. */
function Step({ n, id, title, hint, done, locked, optional, children }: { n: number; id: string; title: string; hint: string; done: boolean; locked?: boolean; optional?: boolean; children: ReactNode }) {
  return <section className="drink-log-step" aria-labelledby={id} data-done={done || undefined} data-locked={locked || undefined} inert={locked}>
    <header className="form-step">
      <span className="form-step-number" aria-hidden="true">{done ? '✓' : n}</span>
      <div><h3 id={id}>{title}{optional && <FormOptional />}</h3><p>{hint}</p></div>
    </header>
    <div className="drink-log-step-body">{children}</div>
  </section>;
}

/** Adds one can: a catalog drink or the member's own, today or yesterday, then optional price and store. */
export function DrinkLogForm({ options, stores, today, yesterday }: { options: StoreDrinkOption[]; stores: string[]; today: string; yesterday: string }) {
  const [state, action, pending] = useActionState<DrinkActionState, FormData>(addDrinkAction, {});
  const [drink, setDrink] = useState<Drink | null>(null);
  const [day, setDay] = useState(today);
  const [price, setPrice] = useState('');
  const [store, setStore] = useState('');
  // A fresh result clears the form only after a success; errors keep what was typed.
  const [handled, setHandled] = useState(state.at);
  if (state.at !== handled) { setHandled(state.at); if (state.success) { setDrink(null); setDay(today); setPrice(''); setStore(''); } }
  return <form className="drink-log-form" action={action}>
    <Step n={1} id="drink-step-drink" title="Что выпили" hint="Найдите энергетик в каталоге или впишите свой." done={drink !== null}>
      {drink ? <div className="drink-log-chosen">
        {drink.cover ? <Image src={drink.cover} width={40} height={40} alt="" /> : <span className="store-drink-cover store-drink-cover-add" aria-hidden="true">⚡</span>}
        <span><strong>{drink.name}</strong><small>{drink.brand ? 'Из каталога' : 'Свой напиток'}</small></span>
        <button type="button" className="community-button community-button-text" onClick={() => setDrink(null)}>Изменить</button>
        <input type="hidden" name="name" value={drink.name} />
        {drink.brand && drink.flavor && <><input type="hidden" name="brand" value={drink.brand} /><input type="hidden" name="flavor" value={drink.flavor} /></>}
      </div> : <><label className="sr-only" htmlFor="drink-log-name">Энергетик</label>
        <StoreDrinkPicker id="drink-log-name" options={options} taken={NOTHING_TAKEN} disabled={pending} placeholder="Например, Burn"
          onAdd={chosen => setDrink({ ...chosen, cover: options.find(option => option.brand === chosen.brand && option.flavor === chosen.flavor)?.cover })} /></>}
    </Step>
    <Step n={2} id="drink-step-day" title="Когда" hint="Забыли отметить вчера — ещё не поздно." done={drink !== null} locked={!drink}>
      <div className="drink-log-days" role="radiogroup" aria-labelledby="drink-step-day">
        {[[today, 'Сегодня'], [yesterday, 'Вчера']].map(([value, label]) => <label key={value}>
          <input type="radio" name="day" value={value} checked={day === value} onChange={() => setDay(value!)} />{label}
        </label>)}
      </div>
    </Step>
    <Step n={3} id="drink-step-details" title="Детали" hint="Цену и магазин видите только вы — из них складываются траты за месяц." optional done={drink !== null && (price !== '' || store !== '')} locked={!drink}>
      <div className="drink-log-row">
        <div className="drink-log-field">
          <label htmlFor="drink-log-price">Цена, ₽</label>
          <input id="drink-log-price" name="price" inputMode="decimal" autoComplete="off" placeholder="129" maxLength={10} value={price} onChange={event => setPrice(event.target.value)} />
        </div>
        <div className="drink-log-field">
          <label htmlFor="drink-log-store">Магазин</label>
          <input id="drink-log-store" name="store" list="drink-log-stores" autoComplete="off" placeholder="Пятёрочка у дома" maxLength={80} value={store} onChange={event => setStore(event.target.value)} />
          <datalist id="drink-log-stores">{stores.map(item => <option key={item} value={item} />)}</datalist>
        </div>
      </div>
    </Step>
    {state.success && <div className="drink-log-celebrate" key={state.at} role="status">
      <DrinkBird mood="happy" size={92} />
      <div className="drink-log-celebrate-text">
        <strong>Отмечено! Птица довольна</strong>
        <p>{state.success.streak > 1 ? <>Серия — <b>{days(state.success.streak)}</b> подряд. Возвращайтесь завтра, чтобы не прервать её.</> : 'Первый день новой серии. Завтра — второй!'}</p>
        <div className="drink-log-rewards">
          {state.success.xp > 0 && <span className="drink-log-xp">+{state.success.xp} XP</span>}
          {state.success.streak > 1 && <span className="drink-log-streak">🔥 {days(state.success.streak)}</span>}
          {state.success.tags.map(tag => <span key={tag.key} className="profile-tag" data-tag={tag.key}>{tag.label}</span>)}
        </div>
        {state.success.tags.length > 0 && <small>{state.success.tags.length > 1 ? 'Новые теги' : 'Новый тег'} — выберите {state.success.tags.length > 1 ? 'их' : 'его'} в профиле.</small>}
      </div>
    </div>}
    <div className="drink-log-submit">
      <button className="community-button" type="submit" disabled={pending || !drink}>{pending ? 'Сохраняем…' : drink ? 'Отметить' : 'Сначала выберите энергетик'}</button>
      {state.error && <p role="alert" className="drink-log-error">{state.error}</p>}
    </div>
  </form>;
}
