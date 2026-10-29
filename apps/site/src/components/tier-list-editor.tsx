'use client';

import { PriceFilterInput } from '@/components/price-filter-input';
import { TierEmojiPicker } from '@/components/tier-emoji-picker';
import { TierScreenshotButton } from '@/components/tier-screenshot-button';
import { compareTierProducts, type TierProductSort } from '@/lib/tier-product-sort';
import { CoverImage } from '@/components/cover-image';
import Link from '@/components/navigation-progress';
import Image from 'next/image';
import { Fragment, useActionState, useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type MouseEvent, type ReactNode } from 'react';
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
  initialList?: Pick<TierListData, 'slug' | 'title' | 'emoji' | 'status' | 'items' | 'tiers' | 'reactionsEnabled' | 'commentsEnabled'>;
  saved?: boolean;
  telegramChannel?: string | null;
  authorUsername?: string;
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

function ActionButtons({ published, dirty, saved, screenshot }: { published: boolean; dirty: boolean; saved: boolean; screenshot: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <div className="tier-editor-save-group">
      {(dirty || saved || pending) && <p className={`tier-editor-save-status${dirty ? ' is-dirty' : ''}`}>{pending ? 'Сохраняем изменения…' : dirty ? 'Есть несохранённые изменения' : 'Изменения сохранены'}</p>}
    <div className="tier-editor-actions">
      <div className="tier-editor-save-row">
      <button className="tier-primary-action" type="submit" name="intent" value="save" disabled={pending}>
        {pending ? 'Сохраняем…' : published ? 'Сохранить изменения' : 'Сохранить'}
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M6 3h10l4 4v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" strokeLinejoin="round" />
          <path d="M8 3v5a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3M8 21v-6a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v6" strokeLinejoin="round" />
        </svg>
      </button>
      {screenshot}
      </div>
      {!published ? (
        <button className="tier-secondary-action" type="submit" name="intent" value="publish" disabled={pending}>
          Опубликовать на сайт
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12 16V3m0 0L7 8m5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : null}
    </div>
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
          <CoverImage src={product.imageUrl} width={compact ? 64 : 96} height={compact ? 64 : 96} sizes={compact ? '64px' : '96px'} alt="" draggable={false} />
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

export function TierListEditor({ products, initialList, saved = false, telegramChannel, authorUsername }: TierListEditorProps) {
  const [state, formAction] = useActionState<TierListFormState, FormData>(saveTierListAction, {});
  const [reactionsEnabled, setReactionsEnabled] = useState(initialList?.reactionsEnabled ?? true);
  const [commentsEnabled, setCommentsEnabled] = useState(initialList?.commentsEnabled ?? true);
  const [columns, setColumns] = useState<EditorColumns>(() => initialColumns(products, initialList?.items ?? []));
  const [tiers, setTiers] = useState<TierKey[]>(() => TIER_KEYS.filter(tier => (initialList?.tiers ?? TIER_KEYS).includes(tier)));
  const [activeSection, setActiveSection] = useState<TierKey>();
  const [sectionNotice, setSectionNotice] = useState('');
  const [selectedId, setSelectedId] = useState<string>();
  const [draggingId, setDraggingId] = useState<string>();
  const [query, setQuery] = useState('');
  const [brand, setBrand] = useState('');
  const [sort, setSort] = useState<TierProductSort>('popular');
  const [availability, setAvailability] = useState<'all' | '4'>('all');
  const [dirty, setDirty] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const brands = useMemo(
    () => [...new Set(products.map((product) => product.brand))].sort((left, right) => left.localeCompare(right, 'ru-RU')),
    [products],
  );

  const selectedProduct = selectedId ? productById.get(selectedId) : undefined;
  const selectedLane = selectedId
    ? (Object.entries(columns).find(([, ids]) => ids.includes(selectedId))?.[0] as EditorLane | undefined)
    : undefined;
  const normalizedQuery = normalizeSearch(query);
  const activeFilters = Number(Boolean(brand)) + Number(availability !== 'all') + Number(sort !== 'popular');
  const screenshot = <TierScreenshotButton boardId="tier-capture-board" titleInputId="tier-list-title" telegramChannel={telegramChannel} authorUsername={authorUsername} iconOnly />;
  const filteredPool = columns.pool
    .map((id) => productById.get(id))
    .filter((product): product is TierListProduct => Boolean(product))
    .filter((product) => {
      if (brand && product.brand !== brand) return false;
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
    const other = tiers[target];
    if (!other) return;
    setColumns(current => ({ ...current, [tier]: current[other], [other]: current[tier] }));
    setActiveSection(other); setDirty(true);
    setSectionNotice(`Содержимое секций ${tier} и ${other} поменялось местами.`);
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
        <div className="tier-editor-title-row">
        <TierEmojiPicker initial={initialList?.emoji ?? null} onChange={() => setDirty(true)} />
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
        </div>
        {state.fieldErrors?.title ? (
          <p className="field-error" id="tier-list-title-error">{state.fieldErrors.title}</p>
        ) : null}
      </div>

      {state.message ? (
        <div className="tier-editor-error" ref={errorRef} role="alert" tabIndex={-1}>
          {state.message}
        </div>
      ) : null}

      <div className="sr-only" role="status">
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
              <div className="tier-editor-rank-buttons" style={{ '--tier-count': tiers.length } as CSSProperties}>
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
              </div>
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

      <p className="review-hint-card tier-section-hint">
        <span className="review-meter-icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11m0-1.5a1.5 1.5 0 0 1 3 0V11m0-.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1a6 6 0 0 1-4.6-2.2L4.6 15.6a1.6 1.6 0 0 1 2.4-2.1L9 15.5" /></svg>
        </span>
        <span>Нажмите на букву секции <span className="tier-section-hint-chip" aria-hidden="true"><span className={`tier-letter tier-letter-${(tiers[0] ?? 'S').toLowerCase()}`}>{tiers[0] ?? 'S'}</span></span>, чтобы поменять её содержимое с соседней или удалить секцию</span>
      </p>
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
            <button type="button" className="community-button community-button-secondary" title="Поменять содержимое с секцией выше" aria-label={`Содержимое ${tier} выше`} disabled={index === 0} onClick={() => moveSection(tier, -1)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 14 6-6 6 6"/></svg></button>
            <button type="button" className="community-button community-button-secondary" title="Поменять содержимое с секцией ниже" aria-label={`Содержимое ${tier} ниже`} disabled={index === tiers.length - 1} onClick={() => moveSection(tier, 1)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 10 6 6 6-6"/></svg></button>
            <button type="button" className="community-button community-button-secondary" title="Удалить секцию — напитки вернутся в общий список" aria-label={`Удалить секцию ${tier}`} disabled={tiers.length === 1} onClick={() => removeSection(tier)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13"/></svg></button>

              <button type="button" className="community-button community-button-secondary" aria-label="Закрыть управление секцией" onClick={() => { setActiveSection(undefined); document.querySelector<HTMLButtonElement>(`#editor-tier-${tier} button`)?.focus(); }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg></button>
            </div>
          </div>}
          </Fragment>
        ))}
      </div>
      <fieldset className="tier-discussion-settings">
        <legend>Обсуждение тирлиста</legend>
        <input type="hidden" name="reactionsEnabled" value={String(reactionsEnabled)} />
        <input type="hidden" name="commentsEnabled" value={String(commentsEnabled)} />
        <DiscussionOption icon="reactions" title="Лайки и дизлайки" hint="Читатели оценят тирлист одним нажатием" checked={reactionsEnabled}
          onChange={value => { setReactionsEnabled(value); setDirty(true); }} />
        <DiscussionOption icon="comments" title="Комментарии" hint="Обсуждение под тирлистом, с ответами и фото" checked={commentsEnabled}
          onChange={value => { setCommentsEnabled(value); setDirty(true); }} />
        <p className="tier-discussion-note"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
          Можно изменить позже. Если выключить, прежние реакции и комментарии скроются, но не удалятся.</p>
      </fieldset>
      {TIER_KEYS.some(tier => !tiers.includes(tier)) && <div className="tier-section-add">{TIER_KEYS.filter(tier => !tiers.includes(tier)).map(tier => <button key={tier} type="button" className="community-button community-button-secondary" onClick={() => { setTiers(current => TIER_KEYS.filter(key => key === tier || current.includes(key))); setActiveSection(tier); setSelectedId(undefined); setDirty(true); setSectionNotice(`Секция ${tier} добавлена.`); }}>+ Добавить {tier}</button>)}</div>}

      <TierChannelBanner channel={telegramChannel} />

      <div className="tier-editor-primary-controls">
        <ActionButtons published={initialList?.status === 'published'} dirty={dirty} saved={saved} screenshot={screenshot} />
        {initialList ? <DeleteTierListButton /> : null}
      </div>

      <section className="tier-editor-pool" aria-labelledby="tier-editor-pool-title">
        <div className="tier-editor-pool-heading">
          <div>
            <h2 id="tier-editor-pool-title">Энергетики</h2>
            <p>{filteredPool.length} из {columns.pool.length} не распределены</p>
          </div>
        </div>

        <div className="tier-editor-filters">
          <label className="catalog-search-field tier-editor-search">
            <span className="sr-only">Поиск энергетиков</span>
            <Image src="/brand/icons/catalog-search.svg" width={24} height={24} alt="" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="Бренд или вкус"
              maxLength={80}
            />
          </label>
          <details className="catalog-filter-disclosure tier-editor-filter-disclosure">
            <summary aria-label={activeFilters ? `Фильтры, выбрано ${activeFilters}` : 'Фильтры'}>
              <Image src="/brand/icons/catalog-filter.svg" width={24} height={24} alt="" />
              {activeFilters > 0 && <span className="catalog-filter-count" aria-hidden="true">{activeFilters}</span>}
            </summary>
            <div className="tier-editor-filter-panel">
              <div className="tier-editor-filter-field">
                <label htmlFor="tier-brand">Бренд</label>
                <PriceFilterInput id="tier-brand" value={brand} options={brands.map(value => ({ value, label: value }))} allLabel="Все бренды" onChange={setBrand} />
              </div>
              <div className="tier-editor-filter-field">
                <label htmlFor="tier-availability">Наличие</label>
                <PriceFilterInput id="tier-availability" value={availability === 'all' ? '' : availability} options={[{ value: '4', label: 'Массовые товары' }]} allLabel="Все товары" onChange={value => setAvailability(value === '4' ? '4' : 'all')} />
              </div>
              <div className="tier-editor-filter-field">
                <label htmlFor="tier-sort">Сортировка</label>
                <PriceFilterInput id="tier-sort" value={sort === 'popular' ? '' : sort} options={[{ value: 'rating', label: 'По рейтингу' }, { value: 'stores', label: 'По наличию в магазинах' }, { value: 'price', label: 'По цене' }]} allLabel="По популярности" onChange={value => setSort((value || 'popular') as TierProductSort)} />
              </div>
            </div>
          </details>
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
              <button type="button" onClick={() => { setQuery(''); setBrand(''); setAvailability('all'); setSort('popular'); }}>
                Сбросить фильтры
              </button>
            </div>
          )}
        </div>
      </section>

      <div className="tier-editor-footer-actions">
        <ActionButtons published={initialList?.status === 'published'} dirty={dirty} saved={saved} screenshot={screenshot} />
      </div>
      </LayoutGroup>
    </form>
  );
}

/**
 * Whose channel the tier list carries: with a channel in the profile, the banner says it goes on the tier list's page
 * and its screenshot; without one, it invites the author to add it. Both lead to the Telegram section of settings.
 */
function TierChannelBanner({ channel }: { channel?: string | null }) {
  return <aside className="tier-channel-banner" data-empty={channel ? undefined : ''} aria-label="Telegram-канал в тирлисте">
    <span className="tier-channel-banner-icon" aria-hidden="true">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M21.9 4.6 18.7 19.7c-.2 1.1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.3-5 9.1-8.2c.4-.4-.1-.6-.6-.2L6.2 13.4l-4.8-1.5c-1-.3-1.1-1 .2-1.5L20.5 3.1c.9-.3 1.6.2 1.4 1.5Z" /></svg>
    </span>
    <div>
      <strong>{channel ? <>Ваш канал <span className="tier-channel-banner-name">@{channel}</span> будет в тирлисте</> : 'Покажите свой Telegram-канал'}</strong>
      <p>{channel
        ? 'При публикации ссылка на канал появится на странице тирлиста и на скриншоте — так читатели найдут вас.'
        : 'Укажите канал в профиле: ссылка на него появится на странице тирлиста и на скриншоте.'}</p>
    </div>
    <Link className="tier-channel-banner-action" href="/profile/settings?section=telegram">{channel ? 'Изменить' : 'Указать канал'}</Link>
  </aside>;
}

const DISCUSSION_ICONS = {
  reactions: <path d="M7 10v11M15 5.9 14 10h5.8a2 2 0 0 1 2 2.3l-1.4 7A2 2 0 0 1 18.4 21H7V10l4-8a3 3 0 0 1 4 3.9ZM3 10h4v11H3z" />,
  comments: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z" />,
} as const;

/** One setting of the discussion: an icon, its name and what it gives, and a switch on the right (a checkbox with role=switch). */
function DiscussionOption({ icon, title, hint, checked, onChange }: { icon: keyof typeof DISCUSSION_ICONS; title: string; hint: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="tier-discussion-option">
    <span className="tier-discussion-icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{DISCUSSION_ICONS[icon]}</svg></span>
    <span className="tier-discussion-text"><b>{title}</b><small>{hint}</small></span>
    <input type="checkbox" role="switch" checked={checked} onChange={event => onChange(event.target.checked)} />
  </label>;
}
