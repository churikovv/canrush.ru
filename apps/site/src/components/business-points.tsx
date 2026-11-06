'use client';

import { startTransition, useActionState, useEffect, useEffectEvent, useMemo, useRef, useState, useTransition } from 'react';
import { CITIES } from '@canrush/shared';
import { deletePointAction, savePointAction, type BusinessActionState } from '@/app/business/cabinet/actions';
import { ActionToast } from '@/components/action-toast';
import { FormAlert } from '@/components/form-alert';
import Link from '@/components/navigation-progress';
import { StoreMap } from '@/components/store-map';
import { POINT_KINDS, POINT_LIMITS, pointCities, pointKindLabel, yandexMapsHref } from '@/lib/business-point-fields';
import type { PointView } from '@/lib/business-points';

/** A drink the team may mark at a point: the company's approved ones. */
export interface PointDrinkOption { brand: string; flavor: string; name: string }

const drinkKey = (brand: string, flavor: string) => JSON.stringify([brand, flavor]);
const PIN = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></svg>;

/**
 * Точки продаж компании: переключатель городов, карта и список с номерами, как у карты магазинов. Нажатие на метку
 * выбирает точку в списке, нажатие на точку в списке — метку на карте. В кабинете (`editable`) — «Добавить точку»,
 * «Изменить» и «Удалить»; в профиле компании — только просмотр.
 */
export function PointsBoard({ points, apiKey, center, editable = false, drinks = [], city: defaultCity, addLabel = 'Добавить точку' }: {
  points: PointView[]; apiKey: string; center: [number, number]; editable?: boolean;
  drinks?: PointDrinkOption[]; /** The visitor's city: first in the switch; a visitor starts in it, the team sees all. */ city?: string; addLabel?: string;
}) {
  const cities = useMemo(() => pointCities(points, defaultCity), [points, defaultCity]);
  const [city, setCity] = useState<string | null>(!editable && cities.length > 1 && cities[0]?.city === defaultCity ? defaultCity ?? null : null);
  const [selected, setSelected] = useState<string | null>(null);
  const shown = useMemo(() => city ? points.filter(point => point.city === city) : points, [points, city]);
  const marks = useMemo(() => shown.map((point, index) => ({ id: point.id, latitude: point.latitude, longitude: point.longitude, label: String(index + 1) })), [shown]);
  const mapCenter = useMemo<[number, number]>(() => {
    const known = CITIES.find(item => item.name === (city ?? defaultCity));
    return known ? [known.lat, known.lng] : center;
  }, [city, defaultCity, center]);
  const list = useRef<HTMLOListElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [editing, setEditing] = useState<PointView | null>(null);
  const [round, setRound] = useState(0);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' }>({ message: '', tone: 'success' });

  function select(id: string, fromMap: boolean) {
    setSelected(id);
    if (fromMap) list.current?.querySelector(`[data-point="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  function open(point: PointView | null) {
    setEditing(point);
    setRound(value => value + 1);
    window.requestAnimationFrame(() => dialog.current?.showModal());
  }
  function saved(isNew: boolean) {
    dialog.current?.close();
    setToast({ message: isNew ? 'Точка добавлена на карту' : 'Точка сохранена', tone: 'success' });
  }

  return <div className="points-board">
    {(editable || cities.length > 1) && <div className="points-toolbar">
      {cities.length > 1 && <div className="points-cities" role="group" aria-label="Город">
        <button type="button" aria-pressed={city === null} onClick={() => { setCity(null); setSelected(null); }}>Все <span>{points.length}</span></button>
        {cities.map(item => <button key={item.city} type="button" aria-pressed={city === item.city} onClick={() => { setCity(item.city); setSelected(null); }}>{item.city} <span>{item.count}</span></button>)}
      </div>}
      {editable && <button type="button" className="bc-button points-add" onClick={() => open(null)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>{addLabel}</button>}
    </div>}

    {points.length > 0 && <div className="points-map" data-no-pull>
      <StoreMap apiKey={apiKey} center={mapCenter} points={marks} selected={selected} onSelect={id => select(id, true)} />
    </div>}

    {shown.length > 0 && <ol className="points-list" ref={list}>{shown.map((point, index) => <li key={point.id} data-point={point.id} data-selected={selected === point.id || undefined}>
      <button type="button" className="points-item" onClick={() => select(point.id, false)} aria-label={`${index + 1}. ${point.name} — показать на карте`}>
        <span className="store-map-number" aria-hidden="true">{index + 1}</span>
        <span className="points-item-text">
          <span className="points-item-head"><strong>{point.name}</strong><small className="points-kind">{pointKindLabel(point.kind)}</small></span>
          <span className="points-address">{point.city}, {point.address}</span>
          {point.hours && <span className="points-meta">{point.hours}</span>}
          {point.note && <span className="points-meta">{point.note}</span>}
        </span>
      </button>
      {point.drinks.length > 0 && <ul className="points-drinks" aria-label="Напитки в этой точке">{point.drinks.map(drink => <li key={drink.href}><Link href={drink.href}>{drink.brand} · {drink.name}</Link></li>)}</ul>}
      <div className="points-actions">
        <a href={yandexMapsHref(point)} target="_blank" rel="noopener noreferrer">{PIN}Яндекс Карты</a>
        {editable && <>
          <button type="button" onClick={() => open(point)}>Изменить</button>
          <DeletePoint id={point.id} name={point.name} onDone={result => setToast(result.error ? { message: result.error, tone: 'error' } : { message: 'Точка удалена', tone: 'success' })} />
        </>}
      </div>
    </li>)}</ol>}

    {editable && <dialog ref={dialog} className="bc-reply-dialog points-dialog" aria-labelledby="point-form-title" onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <PointForm key={round} point={editing} drinks={drinks} defaultCity={defaultCity ?? CITIES[0].name} onSaved={saved} onCancel={() => dialog.current?.close()} />
    </dialog>}
    <ActionToast message={toast.message || undefined} tone={toast.tone} trigger={toast} />
  </div>;
}

/** «Удалить» в два нажатия: второе — «Удалить точку?». */
function DeletePoint({ id, name, onDone }: { id: string; name: string; onDone: (result: BusinessActionState) => void }) {
  const [asking, setAsking] = useState(false);
  const [pending, start] = useTransition();
  useEffect(() => {
    if (!asking) return;
    const timer = window.setTimeout(() => setAsking(false), 4000);
    return () => clearTimeout(timer);
  }, [asking]);
  return <button type="button" className={asking ? 'is-danger' : undefined} disabled={pending} aria-label={asking ? `Точно удалить «${name}»?` : `Удалить «${name}»`}
    onClick={() => {
      if (!asking) { setAsking(true); return; }
      start(async () => { onDone(await deletePointAction(id).catch(() => ({ error: 'Нет связи с сервером. Попробуйте ещё раз.' }))); setAsking(false); });
    }}>{pending ? 'Удаляем…' : asking ? 'Точно удалить?' : 'Удалить'}</button>;
}

/** The point's form in the dialog: the server looks the address up on the map, so a typo comes back as an error here. */
function PointForm({ point, drinks, defaultCity, onSaved, onCancel }: { point: PointView | null; drinks: PointDrinkOption[]; defaultCity: string; onSaved: (isNew: boolean) => void; onCancel: () => void }) {
  const [state, action, pending] = useActionState(savePointAction.bind(null, point?.id ?? null), {});
  const [picked, setPicked] = useState<Set<string>>(() => new Set(point?.drinkKeys ?? []));
  const done = useEffectEvent(() => onSaved(!point));
  useEffect(() => { if (state.done) done(); }, [state]);
  // Sent by hand, not as the form's action: after an action React resets the form, and a typo in the address would
  // take the rest of what was typed with it.
  return <form className="points-form" onSubmit={event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    picked.forEach(value => data.append('drink', value));
    startTransition(() => action(data));
  }}>
    <h2 id="point-form-title">{point ? 'Точка продаж' : 'Новая точка продаж'}</h2>
    <label className="bc-field"><span>Название</span><input name="name" required maxLength={POINT_LIMITS.name} defaultValue={point?.name} placeholder="Пятёрочка на Ленина" /></label>
    <label className="bc-field"><span>Что это</span><select name="kind" defaultValue={point?.kind ?? 'store'}>{POINT_KINDS.map(kind => <option key={kind.value} value={kind.value}>{kind.label}</option>)}</select></label>
    <div className="bc-store-form-row">
      <label className="bc-field"><span>Город</span><input name="city" required list="point-cities" maxLength={POINT_LIMITS.city} defaultValue={point?.city ?? defaultCity} autoComplete="address-level2" /></label>
      <label className="bc-field"><span>Адрес</span><input name="address" required maxLength={POINT_LIMITS.address} defaultValue={point?.address} placeholder="ул. Ленина, 12" autoComplete="street-address" /></label>
    </div>
    <datalist id="point-cities">{CITIES.map(city => <option key={city.id} value={city.name} />)}</datalist>
    <label className="bc-field"><span>Часы работы (необязательно)</span><input name="hours" maxLength={POINT_LIMITS.hours} defaultValue={point?.hours ?? ''} placeholder="Ежедневно 9:00–23:00" /></label>
    <label className="bc-field"><span>Заметка для покупателей (необязательно)</span><input name="note" maxLength={POINT_LIMITS.note} defaultValue={point?.note ?? ''} placeholder="Вход со двора, холодильник у кассы" /></label>
    {drinks.length > 0 && <fieldset className="points-form-drinks">
      <legend>Какие напитки здесь есть</legend>
      <div className="bc-chips">{drinks.map(drink => {
        const value = drinkKey(drink.brand, drink.flavor);
        return <button key={value} type="button" className="bc-chip" aria-pressed={picked.has(value)} onClick={() => setPicked(current => { const next = new Set(current); if (next.has(value)) next.delete(value); else next.add(value); return next; })}>{drink.brand} · {drink.name}</button>;
      })}</div>
    </fieldset>}
    <p className="bc-muted">Адрес найдём на карте сами. Для городов не из списка пишите город полностью — «Тула», «Сочи».</p>
    {state.error && <FormAlert>{state.error}</FormAlert>}
    <div className="bc-reply-actions">
      <button className="bc-button" disabled={pending}>{pending ? 'Ищем адрес…' : point ? 'Сохранить' : 'Добавить на карту'}</button>
      <button type="button" className="bc-button is-outline" disabled={pending} onClick={onCancel}>Отмена</button>
    </div>
  </form>;
}
