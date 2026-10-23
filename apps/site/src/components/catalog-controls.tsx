'use client';

import { PriceFilterInput } from '@/components/price-filter-input';
import Image from 'next/image';
import Link from '@/components/navigation-progress';
import { useRouter } from 'next/navigation';
import { type ChangeEvent, type FormEvent, useEffect, useRef, useState, useTransition } from 'react';

const SEARCH_DELAY_MS = 300;
const CATALOG_PARAMS = ['q', 'brand', 'flavor', 'sort'] as const;

interface CatalogControlsProps {
  brands: string[];
  flavors: Array<{ value: string; label: string }>;
  query: string;
  brand: string;
  flavor: string;
  sort: string;
  /** Page the controls navigate to: the catalog itself or the search page that embeds it. */
  basePath?: string;
  /** Extra query parameters kept on every navigation (the search scope). */
  keep?: Record<string, string>;
  /** A «+» after the filter button that opens the form for a missing drink. */
  addHref?: string;
}

function catalogHref(form: HTMLFormElement, basePath: string, keep: Record<string, string>, query?: string): string {
  const data = new FormData(form);
  if (query !== undefined) data.set('q', query);
  const params = new URLSearchParams(keep);
  for (const name of CATALOG_PARAMS) {
    const entry = data.get(name);
    if (typeof entry !== 'string') continue;
    const value = name === 'q' ? entry.trim().slice(0, 80) : entry;
    if (!value || (name === 'sort' && value === 'stores')) continue;
    params.set(name, value);
  }
  const search = params.toString();
  return search ? `${basePath}?${search}` : basePath;
}

export function CatalogControls({ brands, flavors, query, brand, flavor, sort, basePath = '/catalog', keep = {}, addHref }: CatalogControlsProps) {
  const router = useRouter();
  const [selectedBrand, setSelectedBrand] = useState(brand);
  const [selectedFlavor, setSelectedFlavor] = useState(flavor);
  const [previousFilters, setPreviousFilters] = useState({ brand, flavor });
  if (previousFilters.brand !== brand || previousFilters.flavor !== flavor) {
    setPreviousFilters({ brand, flavor });
    setSelectedBrand(brand); setSelectedFlavor(flavor);
  }
  // Brand, flavor and a sort other than the default «По наличию», shown on the filter button like the market's.
  const active = [brand, flavor, sort !== 'stores' ? sort : ''].filter(Boolean).length;
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  useEffect(() => {
    const input = inputRef.current;
    if (input && document.activeElement !== input) input.value = query;
  }, [query]);

  function clearTimer(): void {
    if (!timerRef.current) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }

  function navigate(form: HTMLFormElement, nextQuery?: string): void {
    clearTimer();
    startTransition(() => router.replace(catalogHref(form, basePath, keep, nextQuery), { scroll: false }));
  }

  function handleSearchChange(event: ChangeEvent<HTMLInputElement>): void {
    const form = event.currentTarget.form;
    if (!form) return;
    const nextQuery = event.currentTarget.value;
    clearTimer();
    timerRef.current = setTimeout(() => navigate(form, nextQuery), SEARCH_DELAY_MS);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    navigate(event.currentTarget, inputRef.current?.value);
  }

  function handleReset(): void {
    clearTimer();
    setSelectedBrand(''); setSelectedFlavor('');
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <form
      className="catalog-controls"
      action={basePath}
      method="get"
      role="search"
      aria-busy={isPending}
      onSubmit={handleSubmit}
    >
      {Object.entries(keep).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      <label className="catalog-search-field">
        <span className="sr-only">Поиск по каталогу</span>
        <Image src="/brand/icons/catalog-search.svg" width={24} height={24} alt="" />
        <input
          ref={inputRef}
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Искать бренд, вкус или магазин"
          autoComplete="off"
          enterKeyHint="search"
          spellCheck={false}
          aria-controls="catalog-results"
          onChange={handleSearchChange}
        />
      </label>

      <details className="catalog-filter-disclosure">
        <summary aria-label={active ? `Фильтры и сортировка, выбрано: ${active}` : 'Фильтры и сортировка'}>
          <Image src="/brand/icons/catalog-filter.svg" width={24} height={24} alt="" />
          {active > 0 && <span className="catalog-filter-count">{active}</span>}
        </summary>
        <div className="catalog-filter-panel">
          <div>
            <label htmlFor="catalog-brand">Бренд</label>
            <input type="hidden" name="brand" value={selectedBrand} />
            <PriceFilterInput id="catalog-brand" value={selectedBrand} options={brands.map(value => ({ value, label: value }))} allLabel="Все бренды" onChange={setSelectedBrand} />
          </div>
          <div>
            <label htmlFor="catalog-flavor">Вкус</label>
            <input type="hidden" name="flavor" value={selectedFlavor} />
            <PriceFilterInput id="catalog-flavor" value={selectedFlavor} options={flavors} allLabel="Все вкусы" onChange={setSelectedFlavor} />
          </div>
          <div>
            <label htmlFor="catalog-sort">Сортировка</label>
            <select id="catalog-sort" name="sort" defaultValue={sort}>
              <option value="stores">По наличию</option>
              <option value="deals">По стоимости</option>
              <option value="discount">По скидке</option>
              <option value="rating">По рейтингу</option>
              <option value="comments">По обсуждаемости</option>
              <option value="brand">По бренду</option>
            </select>
          </div>
          <div className="catalog-filter-actions">
            <Link href={Object.keys(keep).length ? `${basePath}?${new URLSearchParams(keep)}` : basePath} onClick={handleReset}>
              Сбросить
            </Link>
            <button type="submit">Применить</button>
          </div>
        </div>
      </details>

      {addHref && <Link className="catalog-add-button" href={addHref} aria-label="Добавить напиток в каталог" title="Добавить напиток">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
      </Link>}

      <button className="sr-only" type="submit">
        Найти
      </button>
    </form>
  );
}
