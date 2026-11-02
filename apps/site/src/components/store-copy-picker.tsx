'use client';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { searchCopyStoresAction } from '@/app/market/stores/actions';
import { pluralRu } from '@/lib/drink-calendar-fields';
import type { CopyStoreOption } from '@/lib/store-preset-fields';

const DEBOUNCE_MS = 250;

/** Поле «Скопировать из магазина»: ищет на сервере по названию и адресу, при фокусе сразу показывает свои магазины и магазины города. */
export function StoreCopyPicker({ id, city, exceptId, disabled, onPick }: { id: string; city: string; exceptId: string | null; disabled?: boolean; onPick: (store: CopyStoreOption) => void }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [found, setFound] = useState<{ query: string; stores: CopyStoreOption[] } | null>(null);
  const asked = useRef(0);
  const trimmed = query.trim();
  const stores = found?.stores ?? [];
  const waiting = open && found?.query !== trimmed;

  useEffect(() => {
    if (!open) return;
    const round = ++asked.current;
    const timer = setTimeout(() => {
      void searchCopyStoresAction(trimmed, city, exceptId).then(result => { if (round === asked.current) setFound({ query: trimmed, stores: result }); }).catch(() => { if (round === asked.current) setFound({ query: trimmed, stores: [] }); });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [open, trimmed, city, exceptId]);

  function choose(index: number) {
    const store = stores[index];
    if (!store) return;
    setQuery('');
    setActive(-1);
    setOpen(false);
    onPick(store);
  }
  return <div className="store-copy-search" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) { setOpen(false); setActive(-1); } }}>
    <label className="catalog-search-field">
      <span className="sr-only">Скопировать ассортимент из магазина</span>
      <Image src="/brand/icons/catalog-search.svg" width={24} height={24} alt="" />
      <input id={id} role="combobox" autoComplete="off" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-options`} disabled={disabled} maxLength={80} spellCheck={false}
      aria-activedescendant={open && active >= 0 && active < stores.length ? `${id}-option-${active}` : undefined}
      placeholder="Название или адрес" value={query}
      onFocus={() => setOpen(true)} onClick={() => setOpen(true)}
      onChange={event => { setQuery(event.target.value); setActive(-1); setOpen(true); }}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); setOpen(false); setActive(-1); }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); if (stores.length) setActive(index => (index < 0 ? (event.key === 'ArrowDown' ? 0 : stores.length - 1) : (index + (event.key === 'ArrowDown' ? 1 : -1) + stores.length) % stores.length)); }
        if (event.key === 'Enter') { event.preventDefault(); if (active >= 0) choose(active); else if (stores.length === 1) choose(0); }
      }} />
    </label>
    {open && <div className="price-filter-popover store-drink-popover">
      <ul id={`${id}-options`} role="listbox" aria-label="Магазины с ассортиментом">
        {stores.map((store, index) => <li key={store.id} id={`${id}-option-${index}`} role="option" aria-selected={false} className={index === active ? 'is-active' : undefined}
          ref={element => { if (index === active) element?.scrollIntoView({ block: 'nearest' }); }} onMouseDown={event => event.preventDefault()} onClick={() => choose(index)}>
          <span className="store-copy-option"><b>{store.name}</b><small>{store.own ? 'Ваш · ' : ''}{store.drinks} {pluralRu(store.drinks, 'напиток', 'напитка', 'напитков')} · {store.address}</small></span>
        </li>)}
      </ul>
      {!stores.length && <p role="status">{waiting ? 'Ищем магазины…' : trimmed ? 'Ничего не найдено' : 'Пока нет магазинов с ассортиментом'}</p>}
    </div>}
  </div>;
}
