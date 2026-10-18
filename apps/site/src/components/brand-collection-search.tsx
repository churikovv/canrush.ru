'use client';
import Image from 'next/image';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { normalizeCollectionSearch } from '@/lib/collection-search';

export const COLLECTION_FILTERS = [
  { key: 'all', label: 'Все' },
  { key: 'started', label: 'Начатые' },
  { key: 'done', label: 'Собранные' },
  { key: 'new', label: 'Не начатые' },
] as const;
export type CollectionFilter = typeof COLLECTION_FILTERS[number]['key'];

/**
 * Filters the server-rendered brand cards in place: a brand match keeps the whole card, a flavor match
 * keeps only matching cans and opens the card. The list keeps working without JavaScript.
 */
export function BrandCollectionSearch({ counts, children }: { counts: Record<CollectionFilter, number>; children: ReactNode }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<CollectionFilter>('all');
  const [shown, setShown] = useState<number | null>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = list.current;
    if (!root) return;
    const needle = normalizeCollectionSearch(query);
    let visible = 0;
    for (const card of root.querySelectorAll<HTMLDetailsElement>('[data-collection-brand]')) {
      const status = card.dataset.status;
      const passes = filter === 'all' || status === filter || (filter === 'started' && status === 'done');
      const brandMatch = !needle || (card.dataset.search ?? '').includes(needle);
      let cans = 0;
      for (const can of card.querySelectorAll<HTMLElement>('[data-collection-can]')) {
        const match = brandMatch || (can.dataset.search ?? '').includes(needle);
        can.hidden = !match;
        if (match) cans++;
      }
      const show = passes && cans > 0;
      card.hidden = !show;
      if (show) visible++;
      card.open = needle && !brandMatch ? true : card.dataset.openDefault === 'true';
    }
    setShown(needle || filter !== 'all' ? visible : null);
  }, [query, filter]);

  return <>
    <div className="brand-collection-tools">
      <label className="catalog-search-field brand-collection-search">
        <span className="sr-only">Поиск по коллекции</span>
        <Image src="/brand/icons/catalog-search.svg" width={24} height={24} alt="" />
        <input type="search" value={query} onChange={event => setQuery(event.currentTarget.value)} placeholder="Искать бренд или вкус"
          autoComplete="off" enterKeyHint="search" spellCheck={false} aria-controls="brand-collection-list" />
      </label>
      <div className="brand-collection-filters" role="group" aria-label="Показать бренды">
        {COLLECTION_FILTERS.map(item => <button key={item.key} type="button" aria-pressed={filter === item.key} onClick={() => setFilter(item.key)}>
          {item.label} <span>{counts[item.key]}</span>
        </button>)}
      </div>
    </div>
    <p className="sr-only" aria-live="polite">{shown === null ? '' : `Найдено брендов: ${shown}`}</p>
    <div ref={list} id="brand-collection-list">{children}</div>
    {shown === 0 && <p className="community-empty brand-collection-empty">Ничего не нашлось. Попробуйте другое название или фильтр.</p>}
  </>;
}
