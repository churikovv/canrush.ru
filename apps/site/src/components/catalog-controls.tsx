'use client';

import { PriceFilterInput } from '@/components/price-filter-input';
import Image from 'next/image';
import Link from '@/components/navigation-progress';
import { useRouter } from 'next/navigation';
import { type ChangeEvent, type FormEvent, type KeyboardEvent, useEffect, useRef, useState, useTransition } from 'react';

const SEARCH_DELAY_MS = 300;
/** Подсказки догоняют ввод быстрее, чем сама выдача: это короткий запрос к `/api/search-suggest`. */
const SUGGEST_DELAY_MS = 120;

/** Бренд из `/api/search-suggest`: `matched` — сколько его напитков подходит под вкус (0 — подошло имя), `query` — что искать. */
type SuggestItem = { brand: string; drinks: number; matched: number; query: string; cover?: string };

function drinksLabel(count: number) {
  const tens = count % 100, ones = count % 10;
  return `${count} ${tens >= 11 && tens <= 14 ? 'напитков' : ones === 1 ? 'напиток' : ones >= 2 && ones <= 4 ? 'напитка' : 'напитков'}`;
}

/** Набранное выделено в названии, если оно там есть как есть (транслитерация и опечатки просто не выделяются). */
function Marked({ text, query }: { text: string; query: string }) {
  const needle = query.trim().toLocaleLowerCase('ru-RU');
  const at = needle ? text.toLocaleLowerCase('ru-RU').indexOf(needle) : -1;
  if (at < 0) return <>{text}</>;
  return <>{text.slice(0, at)}<mark>{text.slice(at, at + needle.length)}</mark>{text.slice(at + needle.length)}</>;
}
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
  /** «На модерации» before the «+»: drinks members sent that wait for review, with how many there are. */
  pending?: { href: string; count: number };
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

export function CatalogControls({ brands, flavors, query, brand, flavor, sort, basePath = '/catalog', keep = {}, addHref, pending }: CatalogControlsProps) {
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
  const [suggestions, setSuggestions] = useState<SuggestItem[]>([]);
  const [typed, setTyped] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestRequest = useRef<AbortController | null>(null);
  // The last row searches what was typed: the whole result list, as Enter does.
  const rows = suggestions.length ? suggestions.length + 1 : 0;

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (suggestTimer.current) clearTimeout(suggestTimer.current);
      suggestRequest.current?.abort();
    },
    [],
  );

  function closeSuggestions() { setOpen(false); setActiveIndex(-1); }

  function requestSuggestions(value: string) {
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    suggestRequest.current?.abort();
    if (value.trim().length < 2) { setSuggestions([]); closeSuggestions(); return; }
    suggestTimer.current = setTimeout(async () => {
      const request = new AbortController();
      suggestRequest.current = request;
      try {
        const response = await fetch(`/api/search-suggest?q=${encodeURIComponent(value.trim())}`, { signal: request.signal });
        const data: { items: SuggestItem[] } = await response.json();
        setSuggestions(data.items);
        setTyped(value.trim());
        setActiveIndex(-1);
        setOpen(document.activeElement === inputRef.current);
      } catch {
        // A newer keystroke aborted it, or the network dropped: the results below still update.
      }
    }, SUGGEST_DELAY_MS);
  }

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
    requestSuggestions(nextQuery);
  }

  /** Бренд — поиск по нему (или по нему и набранному вкусу), последняя строка — поиск набранного как есть. */
  function choose(index: number) {
    const input = inputRef.current;
    const form = input?.form;
    if (!input || !form) return;
    const value = suggestions[index]?.query ?? input.value;
    closeSuggestions();
    input.blur();
    input.value = value;
    navigate(form, value);
  }

  function handleSearchKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape' && open) { event.preventDefault(); closeSuggestions(); return; }
    if (!rows) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex(current => (event.key === 'ArrowDown' ? (current + 1) % rows : (current <= 0 ? rows - 1 : current - 1)));
    } else if (event.key === 'Enter' && open && activeIndex >= 0) {
      event.preventDefault();
      choose(activeIndex);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    closeSuggestions();
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
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open && rows > 0}
          aria-controls={open && rows > 0 ? 'catalog-suggest' : 'catalog-results'}
          aria-activedescendant={open && activeIndex >= 0 ? `catalog-suggest-${activeIndex}` : undefined}
          onChange={handleSearchChange}
          onKeyDown={handleSearchKey}
          onFocus={() => { if (rows) setOpen(true); }}
          onBlur={closeSuggestions}
        />
      </label>

      {open && rows > 0 && <ul className="catalog-suggest" id="catalog-suggest" role="listbox" aria-label="Подсказки"
        // Pressing a row must not blur the field first: the blur would close the list before the click lands.
        onMouseDown={event => event.preventDefault()}>
        {suggestions.map((item, index) => <li key={item.brand} id={`catalog-suggest-${index}`} role="option"
          aria-selected={index === activeIndex} className="catalog-suggest-row" onClick={() => choose(index)}>
          <span className="catalog-suggest-cover">{item.cover ? <Image src={item.cover} width={40} height={40} alt="" unoptimized /> : null}</span>
          <span className="catalog-suggest-text">
            <strong><Marked text={item.brand} query={typed} /></strong>
            <small>{item.matched ? `${drinksLabel(item.matched)} по запросу · всего ${item.drinks}` : `Бренд · ${drinksLabel(item.drinks)}`}</small>
          </span>
        </li>)}
        <li id={`catalog-suggest-${suggestions.length}`} role="option" aria-selected={activeIndex === suggestions.length} className="catalog-suggest-row is-all" onClick={() => choose(suggestions.length)}>
          <span className="catalog-suggest-cover" aria-hidden="true"><Image src="/brand/icons/catalog-search.svg" width={22} height={22} alt="" /></span>
          <span className="catalog-suggest-text"><strong>Все результаты: «{typed}»</strong></span>
        </li>
      </ul>}

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

      {pending && <Link className="catalog-add-button catalog-pending-button" href={pending.href}
        aria-label={pending.count ? `На модерации: ${pending.count}` : 'На модерации'} title="На модерации">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 3h10M7 21h10M8 3v3a4 4 0 0 0 8 0V3M8 21v-3a4 4 0 0 1 8 0v3" /></svg>
        {pending.count > 0 && <span className="catalog-pending-badge" aria-hidden="true">{pending.count > 99 ? '99+' : pending.count}</span>}
      </Link>}

      {addHref && <Link className="catalog-add-button" href={addHref} aria-label="Добавить напиток в каталог" title="Добавить напиток">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
      </Link>}

      <button className="sr-only" type="submit">
        Найти
      </button>
    </form>
  );
}
