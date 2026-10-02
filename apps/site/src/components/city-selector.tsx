'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { CITIES, nearestCity, type CityId } from '@canrush/shared';
import { selectCityAction } from '@/app/location/actions';
export function CitySelector({ selected }: { selected: CityId }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [locating, setLocating] = useState(false);
  const [suggestion, setSuggestion] = useState<CityId | null>(null);
  const [pending, startTransition] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);
  const request = useRef({ value: 0 });
  const city = CITIES.find(item => item.id === selected)!;
  useEffect(() => {
    if (!open) return;
    const generation = request.current;
    const previous = document.activeElement as HTMLElement | null;
    const modal = dialog.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; modal?.showModal();
    return () => { generation.value++; modal?.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, [open]);
  function choose(id: CityId) {
    request.current.value++; setLocating(false); setError('');
    startTransition(async () => {
      try { const result = await selectCityAction(id); if (result.error) setError(result.error); else { setOpen(false); setQuery(''); setSuggestion(null); } }
      catch { setError('Не удалось сохранить город. Попробуйте ещё раз.'); }
    });
  }
  function locate() {
    setError(''); setSuggestion(null);
    if (!navigator.geolocation) { setError('Геолокация недоступна. Выберите город вручную.'); return; }
    const ticket = ++request.current.value; setLocating(true);
    navigator.geolocation.getCurrentPosition(position => {
      if (ticket !== request.current.value) return;
      setLocating(false);
      const found = nearestCity(position.coords.latitude, position.coords.longitude);
      if (found && position.coords.accuracy <= 30_000) setSuggestion(found.id);
      else setError('Рядом не найден поддерживаемый город. Выберите город вручную.');
    }, failure => {
      if (ticket !== request.current.value) return;
      setLocating(false);
      setError(failure.code === 1 ? 'Доступ к геолокации закрыт. Выберите город вручную.' : 'Не удалось определить местоположение. Выберите город вручную.');
    }, { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 });
  }
  const normalize = (value: string) => value.toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').replace(/[-\s]/g, '');
  const cities = CITIES.filter(item => normalize(`${item.name} ${item.id}${item.id === 'saint-petersburg' ? ' спб питер' : item.id === 'moscow' ? ' мск' : ''}`).includes(normalize(query)));
  return <>
    <button type="button" className="city-header-button" onClick={() => { setOpen(true); setError(''); setLocating(false); }} aria-label={`Город: ${city.name}. Изменить город`} aria-haspopup="dialog"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2.5" /></svg><span>{city.name}</span><span aria-hidden="true">⌄</span></button>
    {open && <dialog ref={dialog} className="city-dialog" aria-labelledby="city-title" onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (!pending) setOpen(false); } }} onCancel={event => { event.preventDefault(); if (!pending) setOpen(false); }}>
      <div className="city-dialog-heading"><h2 id="city-title">Ваш город</h2><button type="button" onClick={() => setOpen(false)} disabled={pending} aria-label="Закрыть выбор города">×</button></div>
      <p>От города зависят ассортимент и цены.</p>
      <button className="city-detect-button" type="button" onClick={locate} disabled={locating || pending}>{locating ? 'Определяем местоположение…' : 'Определить по геолокации'}</button>
      {suggestion && <div className="city-suggestion"><span>Рядом с вами: {CITIES.find(item => item.id === suggestion)?.name}</span><button className="community-button" type="button" disabled={pending} onClick={() => choose(suggestion)}>Выбрать этот город</button></div>}
      {error && <p className="field-error" role="alert">{error}</p>}
      <label className="city-search">Найти город<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Название города" autoComplete="off" maxLength={50} disabled={pending} /></label>
      <ul className="city-options" aria-label="Города" aria-busy={pending}>{cities.map(item => <li key={item.id}><button type="button" disabled={pending} aria-pressed={item.id === selected} onClick={() => choose(item.id)}><span>{item.name}</span>{item.id === selected && <span aria-hidden="true">✓</span>}</button></li>)}</ul>
      {!cities.length && <p role="status">Город не найден. Пока доступны 16 городов-миллионников.</p>}
      {pending && <p role="status">Обновляем ассортимент…</p>}
    </dialog>}
  </>;
}
