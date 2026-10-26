'use client';
import { useActionState, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { addDrinkAction, type DrinkActionState } from '@/app/profile/calendar-actions';
import { DrinkBird } from '@/components/drink-bird';
import { FormAlert } from '@/components/form-alert';
import { StoreDrinkPicker } from '@/components/store-drink-picker';
import { days } from '@/lib/drink-calendar-fields';
import type { StoreDrinkOption } from '@/lib/store-catalog';

type Drink = { name: string; brand?: string; flavor?: string; cover?: string };
const NOTHING_TAKEN = new Set<string>();
const STEPS = ['Что выпили', 'Когда', 'Детали'] as const;
/** Links elsewhere on the site («Отметить энергетик») lead here with this hash and open the form right away. */
const OPEN_HASH = '#add-drink';

/**
 * «Отметить» on the drink calendar: a floating button over the tab bar that opens the form as a sheet, one step at a
 * time — the drink, the day (today or yesterday), then optional price and store. Every value goes to the action from
 * state through hidden inputs: React resets the form's DOM after an action.
 */
export function DrinkLogForm({ options, stores, today, yesterday }: { options: StoreDrinkOption[]; stores: string[]; today: string; yesterday: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState<DrinkActionState, FormData>(addDrinkAction, {});
  const [step, setStep] = useState(0);
  const [drink, setDrink] = useState<Drink | null>(null);
  const [day, setDay] = useState(today);
  const [price, setPrice] = useState('');
  const [store, setStore] = useState('');
  const [handled, setHandled] = useState(state.at);
  const [done, setDone] = useState<DrinkActionState['success'] | null>(null);
  if (state.at !== handled) {
    setHandled(state.at);
    if (state.success) { setDone(state.success); setDrink(null); setDay(today); setPrice(''); setStore(''); setStep(0); }
  }

  function open() { setDone(null); dialog.current?.showModal(); }
  function close() { dialog.current?.close(); }
  useEffect(() => {
    const check = () => { if (window.location.hash === OPEN_HASH && !dialog.current?.open) { setDone(null); dialog.current?.showModal(); } };
    check();
    window.addEventListener('hashchange', check);
    return () => window.removeEventListener('hashchange', check);
  }, []);
  // Closing drops the hash, so the same link opens the form again.
  function onClose() { if (window.location.hash === OPEN_HASH) history.replaceState(null, '', window.location.pathname + window.location.search); }

  return <>
    <button type="button" className="drink-add-fab" onClick={open}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
      Отметить
    </button>
    <dialog ref={dialog} className="drink-add-sheet" aria-labelledby="drink-add-title" onClose={onClose}
      onClick={event => { if (event.target === event.currentTarget) close(); }}>
      <div className="drink-add-head">
        <h2 id="drink-add-title">{done ? 'Готово' : 'Отметить энергетик'}</h2>
        <button type="button" className="drink-add-close" onClick={close} aria-label="Закрыть">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>

      {done ? <div className="drink-log-celebrate" role="status">
        <DrinkBird mood="happy" size={84} />
        <div className="drink-log-celebrate-text">
          <strong>Отмечено! Птица довольна</strong>
          <p>{done.streak > 1 ? <>Серия — <b>{days(done.streak)}</b> подряд. Возвращайтесь завтра, чтобы не прервать её.</> : 'Первый день новой серии. Завтра — второй!'}</p>
          <div className="drink-log-rewards">
            {done.xp > 0 && <span className="drink-log-xp">+{done.xp} XP</span>}
            {done.streak > 1 && <span className="drink-log-streak">🔥 {days(done.streak)}</span>}
            {done.tags.map(tag => <span key={tag.key} className="profile-tag" data-tag={tag.key}>{tag.label}</span>)}
          </div>
          {done.tags.length > 0 && <small>{done.tags.length > 1 ? 'Новые теги' : 'Новый тег'} — выберите {done.tags.length > 1 ? 'их' : 'его'} в профиле.</small>}
        </div>
        <div className="drink-add-actions">
          <button type="button" className="community-button" onClick={close}>Готово</button>
          <button type="button" className="community-button community-button-secondary" onClick={() => setDone(null)}>Ещё банку</button>
        </div>
      </div> : <form className="drink-log-form" action={action}>
        <ol className="drink-add-progress" aria-label={`Шаг ${step + 1} из ${STEPS.length}`}>
          {STEPS.map((title, index) => <li key={title} data-state={index < step ? 'done' : index === step ? 'current' : undefined}>
            <span aria-hidden="true">{index < step ? '✓' : index + 1}</span>{title}
          </li>)}
        </ol>
        <input type="hidden" name="name" value={drink?.name ?? ''} />
        {drink?.brand && drink.flavor && <><input type="hidden" name="brand" value={drink.brand} /><input type="hidden" name="flavor" value={drink.flavor} /></>}
        <input type="hidden" name="day" value={day} />
        <input type="hidden" name="price" value={price} />
        <input type="hidden" name="store" value={store} />

        <section className="drink-add-step" hidden={step !== 0}>
          <p className="drink-add-hint">Найдите энергетик в каталоге или впишите свой.</p>
          {drink && <div className="drink-log-chosen">
            {drink.cover ? <Image src={drink.cover} width={40} height={40} alt="" unoptimized={drink.cover.startsWith('/')} /> : <span className="store-drink-cover store-drink-cover-add" aria-hidden="true">⚡</span>}
            <span><strong>{drink.name}</strong><small>{drink.brand ? 'Из каталога' : 'Свой напиток'}</small></span>
            <button type="button" className="community-button community-button-text" onClick={() => setDrink(null)}>Изменить</button>
          </div>}
          {!drink && <><label className="sr-only" htmlFor="drink-log-name">Энергетик</label>
            <StoreDrinkPicker id="drink-log-name" options={options} taken={NOTHING_TAKEN} disabled={pending} placeholder="Например, Burn"
              onAdd={chosen => { setDrink({ ...chosen, cover: options.find(option => option.brand === chosen.brand && option.flavor === chosen.flavor)?.cover }); setStep(1); }} /></>}
        </section>

        <section className="drink-add-step" hidden={step !== 1}>
          <p className="drink-add-hint">Забыли отметить вчера — ещё не поздно.</p>
          <div className="drink-add-days">
            {[[today, 'Сегодня'], [yesterday, 'Вчера']].map(([value, label]) => <button key={value} type="button" aria-pressed={day === value}
              onClick={() => { setDay(value!); setStep(2); }}>{label}</button>)}
          </div>
        </section>

        <section className="drink-add-step" hidden={step !== 2}>
          <p className="drink-add-hint">Необязательно. Цену и магазин видите только вы — из них складываются траты за месяц.</p>
          <div className="drink-log-row">
            <div className="drink-log-field">
              <label htmlFor="drink-log-price">Цена, ₽</label>
              <input id="drink-log-price" inputMode="decimal" autoComplete="off" placeholder="129" maxLength={10} value={price} onChange={event => setPrice(event.target.value)} />
            </div>
            <div className="drink-log-field">
              <label htmlFor="drink-log-store">Магазин</label>
              <input id="drink-log-store" list="drink-log-stores" autoComplete="off" placeholder="Пятёрочка у дома" maxLength={80} value={store} onChange={event => setStore(event.target.value)} />
              <datalist id="drink-log-stores">{stores.map(item => <option key={item} value={item} />)}</datalist>
            </div>
          </div>
        </section>

        {state.error && <FormAlert>{state.error}</FormAlert>}
        <div className="drink-add-actions">
          {step < 2
            ? <button type="button" className="community-button" disabled={!drink} onClick={() => setStep(step + 1)}>{drink ? 'Далее' : 'Сначала выберите энергетик'}</button>
            : <button type="submit" className="community-button" disabled={pending || !drink}>{pending ? 'Сохраняем…' : 'Отметить'}</button>}
          {step > 0 && <button type="button" className="community-button community-button-secondary" disabled={pending} onClick={() => setStep(step - 1)}>Назад</button>}
        </div>
      </form>}
    </dialog>
  </>;
}
