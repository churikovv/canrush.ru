'use client';

import { PriceFilterInput } from '@/components/price-filter-input';
import { TierScreenshotButton } from '@/components/tier-screenshot-button';
import { compareTierProducts, type TierProductSort } from '@/lib/tier-product-sort';
import Image from 'next/image';
import Link from '@/components/navigation-progress';
import { Fragment, useActionState, useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent } from 'react';
import { useFormStatus } from 'react-dom';
import { LayoutGroup, motion } from 'motion/react';
import { deleteTierListAction, saveTierListAction, type TierListFormState } from '@/app/tierlists/actions';
import {
  TIER_KEYS,
  type TierKey,
  type TierListData,
  type TierListPlacement,
  type TierListProduct,
} from '@/lib/tier-list-types';

type EditorLane = TierKey | 'pool';
type EditorColumns = Record<EditorLane, string[]>;

interface TierListEditorProps {
  products: TierListProduct[];
  initialList?: Pick<TierListData, 'slug' | 'title' | 'status' | 'items' | 'tiers'>;
  saved?: boolean;
}

function productKey(brand: string, flavor: string): string {
  return `${brand}\u0000${flavor}`;
}

function initialColumns(products: TierListProduct[], placements: TierListPlacement[]): EditorColumns {
  const idByProduct = new Map(products.map((product) => [productKey(product.brand, product.flavor), product.id]));
  const assigned = new Set<string>();
  const columns: EditorColumns = { SS: [], S: [], A: [], B: [], C: [], D: [], pool: [] };

  for (const tier of TIER_KEYS) {
    for (const placement of placements
      .filter((item) => item.tier === tier)
      .sort((left, right) => left.position - right.position)) {
      const id = idByProduct.get(productKey(placement.brand, placement.flavor));
      if (!id || assigned.has(id)) continue;
      columns[tier].push(id);
      assigned.add(id);
    }
  }

  columns.pool = products.filter((product) => !assigned.has(product.id)).map((product) => product.id);
  return columns;
}

function normalizeSearch(value: string): string {
  return value.toLocaleLowerCase('ru-RU').replace(/ё/gu, 'е').trim();
}

function ActionButtons({ published }: { published: boolean }) {
  const { pending } = useFormStatus();
  return (
    <div className="tier-editor-actions">
      <button className="tier-primary-action" type="submit" name="intent" value="save" disabled={pending}>
        {pending ? 'Сохраняем…' : published ? 'Сохранить изменения' : 'Сохранить'}
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M5 4h12l2 2v14H5z" strokeLinejoin="round" />
          <path d="M8 4v6h8V4M8 20v-6h8v6" strokeLinejoin="round" />
        </svg>
      </button>
      {!published ? (
        <button className="tier-secondary-action" type="submit" name="intent" value="publish" disabled={pending}>
          Опубликовать на сайт
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12 16V3m0 0L7 8m5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5 13v6h14v-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

function DeleteTierListButton() {
  const { pending } = useFormStatus();

  function confirmDelete(event: MouseEvent<HTMLButtonElement>): void {
    if (!window.confirm('Удалить этот тирлист без возможности восстановления?')) event.preventDefault();
  }

  return (
    <button
      className="tier-delete-action"
      type="submit"
      formAction={deleteTierListAction}
      formNoValidate
      disabled={pending}
      onClick={confirmDelete}
    >
      {pending ? 'Удаляем…' : 'Удалить тирлист'}
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

interface ProductButtonProps {
  product: TierListProduct;
  selected: boolean;
  compact: boolean;
  onSelect: () => void;
  onDragStart: (event: DragEvent<HTMLButtonElement>) => void;
  onDragEnd: () => void;
  onDrop?: (event: DragEvent<HTMLButtonElement>) => void;
}

function ProductButton({ product, selected, compact, onSelect, onDragStart, onDragEnd, onDrop }: ProductButtonProps) {
  const label = `${product.brand}, ${product.flavorLabel}`;
  return (
    <motion.button
      className={`motion-local tier-editor-product${compact ? ' tier-editor-product-compact' : ''}${selected ? ' tier-editor-product-selected' : ''}`}
      type="button"
      draggable
      layoutId={`tier-editor-product-${product.id}`}
      whileTap={{ scale: 0.97 }}
      transition={{
        layout: { type: 'spring', stiffness: 520, damping: 42 },
        scale: { duration: 0.08 },
      }}
      aria-pressed={selected}
      aria-label={`${selected ? 'Выбран' : 'Выбрать'} ${label}`}
      title={label}
      onClick={onSelect}
      onDragStartCapture={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
      <span className="tier-editor-product-image" aria-hidden="true">
        {product.imageUrl ? (
          <Image src={product.imageUrl} width={compact ? 64 : 96} height={compact ? 64 : 96} sizes={compact ? '64px' : '96px'} alt="" draggable={false} />
        ) : (
          <span>{product.brand.slice(0, 2).toLocaleUpperCase('ru-RU')}</span>
        )}
      </span>
      <span className={compact ? 'sr-only' : 'tier-editor-product-copy'}>
        <strong>{product.brand}</strong>
        <span>{product.flavorLabel}</span>
        <small>{product.retailerCount} {product.retailerCount === 1 ? 'магазин' : 'магазинов'}</small>
      </span>
    </motion.button>
  );
}

export function TierListEditor({ products, initialList, saved = false }: TierListEditorProps) {
  const [state, formAction] = useActionState<TierListFormState, FormData>(saveTierListAction, {});
  const [columns, setColumns] = useState<EditorColumns>(() => initialColumns(products, initialList?.items ?? []));
  const [tiers, setTiers] = useState<TierKey[]>(() => [...(initialList?.tiers ?? TIER_KEYS)]);
  const [activeSection, setActiveSection] = useState<TierKey>();
  const [sectionNotice, setSectionNotice] = useState('');
  const [selectedId, setSelectedId] = useState<string>();
  const [draggingId, setDraggingId] = useState<string>();
  const [query, setQuery] = useState('');
  const [brand, setBrand] = useState('');
  const [flavor, setFlavor] = useState('');
  const [sort, setSort] = useState<TierProductSort>('popular');
  const [availability, setAvailability] = useState<'all' | '4'>('all');
  const [dirty, setDirty] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const brands = useMemo(
    () => [...new Set(products.map((product) => product.brand))].sort((left, right) => left.localeCompare(right, 'ru-RU')),
    [products],
  );
  const flavors = useMemo(
    () =>
      [...new Map(products.map((product) => [product.flavor, product.flavorLabel])).entries()]
        .map(([value, label]) => ({ value, label }))
        .sort((left, right) => left.label.localeCompare(right.label, 'ru-RU')),
    [products],
  );

  const selectedProduct = selectedId ? productById.get(selectedId) : undefined;
  const selectedLane = selectedId
    ? (Object.entries(columns).find(([, ids]) => ids.includes(selectedId))?.[0] as EditorLane | undefined)
    : undefined;
  const normalizedQuery = normalizeSearch(query);
  const filteredPool = columns.pool
    .map((id) => productById.get(id))
    .filter((product): product is TierListProduct => Boolean(product))
    .filter((product) => {
      if (brand && product.brand !== brand) return false;
      if (flavor && product.flavor !== flavor) return false;
      if (availability === '4' && product.retailerCount < 4) return false;
      if (!normalizedQuery) return true;
      return normalizeSearch(`${product.brand} ${product.flavorLabel}`).includes(normalizedQuery);
    }).sort((a, b) => compareTierProducts(a, b, sort));

  const placements = tiers.flatMap((tier) =>
    columns[tier].flatMap((id, position) => {
      const product = productById.get(id);
      return product ? [{ brand: product.brand, flavor: product.flavor, tier, position }] : [];
    }),
  );

  useEffect(() => {
    if (state.status === 'error') errorRef.current?.focus();
  }, [state]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function moveProduct(id: string, target: EditorLane, targetIndex?: number) {
    if (!productById.has(id)) return;
    setColumns((current) => {
      const next = Object.fromEntries(
        Object.entries(current).map(([lane, ids]) => [lane, ids.filter((itemId) => itemId !== id)]),
      ) as EditorColumns;
      const insertAt = targetIndex === undefined ? next[target].length : Math.min(Math.max(targetIndex, 0), next[target].length);
      next[target] = [...next[target].slice(0, insertAt), id, ...next[target].slice(insertAt)];
      return next;
    });
    setSelectedId(id);
    setDirty(true);
  }

  function moveSection(tier: TierKey, offset: number) {
    const index = tiers.indexOf(tier), target = index + offset;
    if (target < 0 || target >= tiers.length) return;
    const next = [...tiers]; next.splice(index, 1); next.splice(target, 0, tier);
    setTiers(next); setDirty(true);
    setSectionNotice(`Секция ${tier} перемещена на позицию ${target + 1}.`);
  }

  function removeSection(tier: TierKey) {
    if (tiers.length === 1) return;
    setColumns(current => ({ ...current, [tier]: [], pool: [...current.pool, ...current[tier]] }));
    setTiers(current => current.filter(item => item !== tier)); setActiveSection(undefined); setDirty(true);
    setSectionNotice(`Секция ${tier} удалена. Напитки возвращены в общий список.`);
  }

  function reorderSelected(offset: -1 | 1) {
    if (!selectedId || !selectedLane || selectedLane === 'pool') return;
    const index = columns[selectedLane].indexOf(selectedId);
    if (index < 0) return;
    moveProduct(selectedId, selectedLane, index + offset);
  }

  function handleDrop(event: DragEvent, target: EditorLane, targetIndex?: number) {
    event.preventDefault();
    event.stopPropagation();
    const id = event.dataTransfer.getData('text/plain') || draggingId;
    if (id) moveProduct(id, target, targetIndex);
    setDraggingId(undefined);
  }

  function renderProduct(id: string, lane: EditorLane, index: number, compact: boolean) {
    const product = productById.get(id);
    if (!product) return null;
    return (
      <ProductButton
        key={id}
        product={product}
        compact={compact}
        selected={selectedId === id}
        onSelect={() => { setSelectedId((current) => (current === id ? undefined : id)); setActiveSection(undefined); }}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', id);
          setDraggingId(id);
        }}
        onDragEnd={() => setDraggingId(undefined)}
        onDrop={(event) => handleDrop(event, lane, index)}
      />
    );
  }

  return (
    <form className="tier-editor" action={formAction}>
      <LayoutGroup id="tier-list-editor">
        <input type="hidden" name="slug" value={initialList?.slug ?? ''} />
        <input type="hidden" name="tiers" value={JSON.stringify(tiers)} />
        <input type="hidden" name="items" value={JSON.stringify(placements)} />

      <div className="tier-editor-title-field">
        <label htmlFor="tier-list-title">Название тирлиста</label>
        <input
          id="tier-list-title"
          name="title"
          type="text"
          defaultValue={initialList?.title ?? 'Мой тирлист энергетиков'}
          maxLength={80}
          aria-invalid={Boolean(state.fieldErrors?.title)}
          aria-describedby={state.fieldErrors?.title ? 'tier-list-title-error' : undefined}
          onChange={() => setDirty(true)}
          required
        />
        {state.fieldErrors?.title ? (
          <p className="field-error" id="tier-list-title-error">{state.fieldErrors.title}</p>
        ) : null}
      </div>

      {state.message ? (
        <div className="tier-editor-error" ref={errorRef} role="alert" tabIndex={-1}>
          {state.message}
        </div>
      ) : null}

      <div className="tier-editor-state" role="status">
        {dirty ? 'Есть несохранённые изменения' : saved ? 'Изменения сохранены' : 'Выберите энергетик или перетащите его в ряд'}
      </div>

      {selectedProduct && <motion.div
        className={`tier-editor-command${selectedLane && selectedLane !== 'pool' ? ' tier-editor-command-ordered' : ''}`}
        aria-live="polite"
        layoutRoot
        initial={false}
      >
          <>
            <p>
              <strong>{selectedProduct.brand}</strong>
              <span>{selectedProduct.flavorLabel}</span>
            </p>
            <div className="tier-editor-command-buttons" role="group" aria-label="Переместить выбранный товар">
              {tiers.map((tier) => (
                <button
                  type="button"
                  key={tier}
                  className={`tier-command-${tier.toLowerCase()}`}
                  aria-pressed={selectedLane === tier}
                  disabled={selectedLane === tier}
                  onClick={() => moveProduct(selectedProduct.id, tier)}
                >
                  <span className={`tier-letter tier-letter-${tier.toLowerCase()}`}>{tier}</span>
                </button>
              ))}
              <button
                className="tier-editor-remove-button"
                type="button"
                aria-label="Убрать из тирлиста"
                title="Убрать из тирлиста"
                disabled={selectedLane === 'pool'}
                onClick={() => moveProduct(selectedProduct.id, 'pool')}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" aria-hidden="true">
                  <path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {selectedLane && selectedLane !== 'pool' ? (
                <>
                  <button
                    className="tier-editor-order-button tier-editor-order-previous"
                    type="button"
                    aria-label="Переместить раньше"
                    title="Переместить раньше"
                    onClick={() => reorderSelected(-1)}
                    disabled={columns[selectedLane].indexOf(selectedProduct.id) === 0}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" aria-hidden="true">
                      <path d="m14 6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button
                    className="tier-editor-order-button tier-editor-order-next"
                    type="button"
                    aria-label="Переместить позже"
                    title="Переместить позже"
                    onClick={() => reorderSelected(1)}
                    disabled={columns[selectedLane].indexOf(selectedProduct.id) === columns[selectedLane].length - 1}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" aria-hidden="true">
                      <path d="m10 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </>
              ) : null}
            </div>
          </>
      </motion.div>}

      <p className="tier-section-hint">Нажмите на букву секции, чтобы переместить или удалить её.</p>
      {state.fieldErrors?.tiers && <p className="field-error" role="alert">{state.fieldErrors.tiers}</p>}
      <p className="sr-only" role="status">{sectionNotice}</p>

      <div id="tier-capture-board" className="tier-editor-board" aria-label="Редактор тирлиста">
        {tiers.map((tier, index) => (
          <Fragment key={tier}>
          <section className={`tier-editor-row tier-editor-row-${tier.toLowerCase()}`} key={tier} aria-labelledby={`editor-tier-${tier}`}>
            <h2 id={`editor-tier-${tier}`}><button type="button" className="tier-section-trigger" aria-label={`Настроить секцию ${tier}`} aria-expanded={activeSection === tier} aria-controls={`tier-controls-${tier}`} onClick={() => { setActiveSection(current => current === tier ? undefined : tier); setSelectedId(undefined); }}><span className={`tier-letter tier-letter-${tier.toLowerCase()}`}>{tier}</span></button></h2>
            <div
              className={`tier-editor-row-items${draggingId ? ' tier-editor-drop-active' : ''}`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => handleDrop(event, tier)}
            >
              {columns[tier].length > 0 ? columns[tier].map((id, index) => renderProduct(id, tier, index, true)) : <span>Переместите сюда</span>}
            </div>
          </section>
          {activeSection === tier && <div id={`tier-controls-${tier}`} className="tier-section-toolbar" role="group" aria-label={`Управление секцией ${tier}`} onKeyDown={event => { if (event.key === 'Escape') { setActiveSection(undefined); document.querySelector<HTMLButtonElement>(`#editor-tier-${tier} button`)?.focus(); } }}>
            <span>Секция {tier}</span>
            <div>
            <button type="button" className="community-button community-button-secondary" title="Переместить выше" aria-label={`Секцию ${tier} выше`} disabled={index === 0} onClick={() => moveSection(tier, -1)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 14 6-6 6 6"/></svg></button>
            <button type="button" className="community-button community-button-secondary" title="Переместить ниже" aria-label={`Секцию ${tier} ниже`} disabled={index === tiers.length - 1} onClick={() => moveSection(tier, 1)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 10 6 6 6-6"/></svg></button>
            <button type="button" className="community-button community-button-secondary" title="Удалить секцию — напитки вернутся в общий список" aria-label={`Удалить секцию ${tier}`} disabled={tiers.length === 1} onClick={() => removeSection(tier)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13"/></svg></button>

              <button type="button" className="community-button community-button-secondary" aria-label="Закрыть управление секцией" onClick={() => { setActiveSection(undefined); document.querySelector<HTMLButtonElement>(`#editor-tier-${tier} button`)?.focus(); }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg></button>
            </div>
          </div>}
          </Fragment>
        ))}
      </div>
      {TIER_KEYS.some(tier => !tiers.includes(tier)) && <div className="tier-section-add">{TIER_KEYS.filter(tier => !tiers.includes(tier)).map(tier => <button key={tier} type="button" className="community-button community-button-secondary" onClick={() => { setTiers(current => [...current, tier]); setActiveSection(tier); setSelectedId(undefined); setDirty(true); setSectionNotice(`Секция ${tier} добавлена.`); }}>+ Добавить {tier}</button>)}</div>}

      <div className="tier-editor-primary-controls">
        <ActionButtons published={initialList?.status === 'published'} />
        <TierScreenshotButton boardId="tier-capture-board" titleInputId="tier-list-title" />
        {initialList ? <DeleteTierListButton /> : null}
      </div>

      <section className="tier-editor-pool" aria-labelledby="tier-editor-pool-title">
        <div className="tier-editor-pool-heading">
          <div>
            <h2 id="tier-editor-pool-title">Энергетики</h2>
            <p>{filteredPool.length} из {columns.pool.length} не распределены</p>
          </div>
          <Link href="/profile/edit">Telegram автора</Link>
        </div>

        <div className="tier-editor-filters">
          <label className="tier-editor-search">
            <span>Поиск</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="Бренд или вкус"
              maxLength={80}
            />
          </label>
          <div className="tier-editor-filter-field">
            <label htmlFor="tier-brand">Бренд</label>
            <PriceFilterInput id="tier-brand" value={brand} options={brands.map(value => ({ value, label: value }))} allLabel="Все бренды" onChange={setBrand} />
          </div>
          <div className="tier-editor-filter-field">
            <label htmlFor="tier-flavor">Вкус</label>
            <PriceFilterInput id="tier-flavor" value={flavor} options={flavors} allLabel="Все вкусы" onChange={setFlavor} />
          </div>
          <div className="tier-editor-filter-field">
            <label htmlFor="tier-availability">Наличие</label>
            <PriceFilterInput id="tier-availability" value={availability === 'all' ? '' : availability} options={[{ value: '4', label: 'В 4+ магазинах' }]} allLabel="Все товары" onChange={value => setAvailability(value === '4' ? '4' : 'all')} />
          </div>
          <div className="tier-editor-filter-field">
            <label htmlFor="tier-sort">Сортировка</label>
            <PriceFilterInput id="tier-sort" value={sort === 'popular' ? '' : sort} options={[{ value: 'rating', label: 'По рейтингу' }, { value: 'stores', label: 'По наличию в магазинах' }, { value: 'price', label: 'По цене' }]} allLabel="По популярности" onChange={value => setSort((value || 'popular') as TierProductSort)} />
          </div>
        </div>

        <div
          className={`tier-editor-pool-grid${draggingId ? ' tier-editor-drop-active' : ''}`}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => handleDrop(event, 'pool')}
        >
          {filteredPool.length > 0 ? (
            filteredPool.map((product) => {
              const index = columns.pool.indexOf(product.id);
              return renderProduct(product.id, 'pool', index, false);
            })
          ) : (
            <div className="tier-editor-empty">
              <strong>Ничего не найдено</strong>
              <span>Измените запрос или сбросьте фильтры.</span>
              <button type="button" onClick={() => { setQuery(''); setBrand(''); setFlavor(''); setAvailability('all'); }}>
                Сбросить фильтры
              </button>
            </div>
          )}
        </div>
      </section>

      <div className="tier-editor-footer-actions">
        <ActionButtons published={initialList?.status === 'published'} />
        <TierScreenshotButton boardId="tier-capture-board" titleInputId="tier-list-title" />
      </div>
      </LayoutGroup>
    </form>
  );
}
