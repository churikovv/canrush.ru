'use client';
import { useId, useMemo, useRef, useState, useSyncExternalStore, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { deleteStorePresetAction, saveStorePresetAction, storeTemplatesAction } from '@/app/market/stores/actions';
import { EditIcon, TrashIcon } from '@/components/action-icons';
import { BottomSheet, BottomSheetHead } from '@/components/bottom-sheet';
import { ContentReportButton } from '@/components/content-report-button';
import { CoverImage } from '@/components/cover-image';
import { FormAlert } from '@/components/form-alert';
import { MoreActions } from '@/components/more-actions';
import { StaffDeleteMenuItem } from '@/components/staff-delete-button';
import { StoreDrinkPicker } from '@/components/store-drink-picker';
import { pluralRu } from '@/lib/drink-calendar-fields';
import type { StoreDrinkOption } from '@/lib/store-catalog';
import { STORE_CATALOG_LIMIT, pasteStoreItems, storeItemKey } from '@/lib/store-clipboard';
import { MIN_PUBLIC_PRESET_DRINKS, PRESET_NAME_LIMIT, presetCaptions, presetClipboard, type PresetDrink, type StoreTemplates as Templates } from '@/lib/store-preset-fields';

const subscribeNever = () => () => {};
const count = (drinks: number) => `${drinks} ${pluralRu(drinks, 'напиток', 'напитка', 'напитков')}`;
const CHEVRON = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>;
const LAYERS = <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12.5 9 5 9-5" /><path d="m3 17 9 5 9-5" /></svg>;

export const REMOVE_ICON = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>;

/** Шаблон в листе: `author` — чужой опубликованный, `id` без автора — свой, без `id` — готовый шаблон бренда. */
interface Template { name: string; drinks: PresetDrink[]; id?: string; author?: string; published?: boolean }
/** Что сейчас на экране редактора: новый шаблон или свой, с `id`. */
interface Draft { id?: string; name: string; drinks: PresetDrink[]; publish: boolean }
type Covers = ReadonlyMap<string, string>;

/** Фото напитка; у своего напитка без фото — первая буква названия. */
function DrinkPhoto({ caption, cover }: { caption: string; cover?: string }) {
  return <span className="store-template-cover">{cover ? <CoverImage src={cover} width={112} height={112} alt="" /> : <span aria-hidden="true">{caption.slice(0, 1)}</span>}</span>;
}

/** Строка списка: название и сразу маленькие фото напитков лентой. Нажатие на фото открывает шаблон, с клавиатуры — его название. */
function TemplateRow({ template, covers, onOpen }: { template: Template; covers: Covers; onOpen: () => void }) {
  const captions = presetCaptions(template.drinks);
  return <li className="store-template">
    <button type="button" className="store-template-head" onClick={onOpen}>
      <span className="store-template-title"><b>{template.name}</b>{template.author ? <small>@{template.author}</small> : template.published && <small>Виден всем</small>}</span>
      <span className="store-template-count">{template.drinks.length}</span>{CHEVRON}
    </button>
    <ul className="store-template-strip" onClick={onOpen}>
      {template.drinks.map((drink, index) => {
        const caption = captions[index] ?? drink.name;
        return <li key={storeItemKey(drink)} title={caption}><DrinkPhoto caption={caption} cover={covers.get(storeItemKey(drink))} /><span className="sr-only">{caption}</span></li>;
      })}
    </ul>
  </li>;
}

function TemplateGroup({ title, rows, covers, onOpen }: { title: string; rows: Template[]; covers: Covers; onOpen: (template: Template) => void }) {
  if (!rows.length) return null;
  return <section className="store-template-group">
    <h3>{title}</h3>
    <ul className="store-template-list">{rows.map(row => <TemplateRow key={row.id ?? row.name} template={row} covers={covers} onOpen={() => onOpen(row)} />)}</ul>
  </section>;
}

/** Экран шаблона внутри листа: все напитки, что уже есть в списке магазина, и кнопка, которая говорит, сколько добавится. */
function TemplateDrinks({ template, items, covers, pending, onAdd }: { template: Template; items: PresetDrink[]; covers: Covers; pending: boolean; onAdd: () => void }) {
  const have = new Set(items.map(storeItemKey));
  const fresh = pasteStoreItems(items, presetClipboard(template.name, template.drinks)).added.length;
  const captions = presetCaptions(template.drinks);
  return <>
    <p className="store-template-lead">{count(template.drinks.length)} без цен{template.author && <>. Автор @{template.author}</>}{template.published && '. Виден всем участникам'}</p>
    <ul className="store-template-grid">
      {template.drinks.map((drink, index) => {
        const caption = captions[index] ?? drink.name;
        const added = have.has(storeItemKey(drink));
        return <li key={storeItemKey(drink)} data-have={added || undefined}>
          <DrinkPhoto caption={caption} cover={covers.get(storeItemKey(drink))} />
          <span className="store-template-caption">{caption}</span>
          {added && <small>Уже в списке</small>}
        </li>;
      })}
    </ul>
    <div className="store-template-actions">
      <button type="button" className="community-button" disabled={pending || !fresh} onClick={onAdd}>{fresh ? `Добавить ${count(fresh)}` : 'Всё уже в списке'}</button>
    </div>
  </>;
}

/** Меню «⋯» в шапке листа: свой шаблон правится и удаляется, на чужой можно пожаловаться, команда удаляет его на месте. У готовых шаблонов меню нет. */
function TemplateMenu({ template, staff, pending, onEdit, onDelete, onRemoved }: { template: Template; staff: boolean; pending: boolean; onEdit: () => void; onDelete: () => void; onRemoved: () => void }) {
  if (!template.id) return null;
  return <MoreActions label="Действия с шаблоном">
    {template.author ? <>
      <ContentReportButton kind="store-preset" id={template.id} variant="menuitem" />
      {staff && <StaffDeleteMenuItem kind="store-preset" id={template.id} onDeleted={onRemoved} />}
    </> : <>
      <button type="button" className="more-actions-item" role="menuitem" disabled={pending} onClick={onEdit}><EditIcon /><span>Редактировать</span></button>
      <button type="button" className="more-actions-item is-danger" role="menuitem" disabled={pending} onClick={onDelete}><TrashIcon /><span>Удалить</span></button>
    </>}
  </MoreActions>;
}

/** Создание и правка прямо в листе: название, напитки тем же выбором, что в форме магазина, и тумблер «Показать всем». */
function TemplateEditor({ draft, options, covers, store, pending, onChange, onSave }: { draft: Draft; options: StoreDrinkOption[]; covers: Covers; store: PresetDrink[]; pending: boolean; onChange: (draft: Draft) => void; onSave: () => void }) {
  const pickerId = useId();
  const keys = draft.drinks.map(storeItemKey);
  const taken = new Set(draft.drinks.filter(drink => drink.brand !== undefined).map(storeItemKey));
  const captions = presetCaptions(draft.drinks);
  const canPublish = draft.drinks.length >= MIN_PUBLIC_PRESET_DRINKS;
  const fresh = store.filter(drink => !keys.includes(storeItemKey(drink)));
  return <div className="store-template-editor">
    <label className="store-template-name">Название<span className="catalog-search-field"><input value={draft.name} maxLength={PRESET_NAME_LIMIT} placeholder="Например, Моя сеть" disabled={pending} onChange={event => onChange({ ...draft, name: event.target.value })} /></span></label>
    {draft.drinks.length < STORE_CATALOG_LIMIT && <div className="store-template-name">
      <label htmlFor={pickerId}>Напитки</label>
      <StoreDrinkPicker id={pickerId} options={options} taken={taken} disabled={pending} placeholder="Найдите или впишите свой" onAdd={drink => { if (!keys.includes(storeItemKey(drink))) onChange({ ...draft, drinks: [...draft.drinks, drink] }); }} />
    </div>}
    {store.length > 0 && <button type="button" className="community-button community-button-secondary" disabled={pending || !fresh.length || draft.drinks.length >= STORE_CATALOG_LIMIT}
      onClick={() => onChange({ ...draft, drinks: [...draft.drinks, ...fresh].slice(0, STORE_CATALOG_LIMIT) })}>{fresh.length ? `Скопировать из этого магазина · ${fresh.length}` : 'Всё из этого магазина уже здесь'}</button>}
    {draft.drinks.length > 0 && <ul className="store-template-grid">
      {draft.drinks.map((drink, index) => {
        const caption = captions[index] ?? drink.name;
        return <li key={storeItemKey(drink)}>
          <DrinkPhoto caption={caption} cover={covers.get(storeItemKey(drink))} />
          <span className="store-template-caption">{caption}</span>
          <button type="button" className="store-template-remove" aria-label={`Убрать: ${drink.name}`} disabled={pending} onClick={() => onChange({ ...draft, drinks: draft.drinks.filter((_, position) => position !== index) })}>
            <span>{REMOVE_ICON}</span>
          </button>
        </li>;
      })}
    </ul>}
    <label className="store-template-public"><span>Опубликовать для всех<small>{canPublish ? 'Увидят название, напитки и ваш ник.' : `Можно от ${MIN_PUBLIC_PRESET_DRINKS} напитков.`}</small></span>
      <input type="checkbox" role="switch" className="settings-switch" checked={draft.publish && canPublish} disabled={pending || !canPublish} onChange={event => onChange({ ...draft, publish: event.target.checked })} /></label>
    <div className="store-template-actions">
      <button type="button" className="community-button" disabled={pending || !draft.name.trim() || !draft.drinks.length} onClick={onSave}>{draft.id ? 'Сохранить' : 'Создать шаблон'}</button>
    </div>
  </div>;
}

/**
 * Значок шаблонов рядом с полем копирования и лист снизу: баннер создания, готовые шаблоны брендов из настоящего наличия, опубликованные шаблоны участников
 * и свои списки. Создание и правка — здесь же, экраном листа. Лист живёт в портале и без своей формы: иначе отправка ушла бы в форму магазина.
 */
export function StoreTemplates({ items, options, disabled, onAdd }: { items: PresetDrink[]; options: StoreDrinkOption[]; disabled?: boolean; onAdd: (name: string, drinks: PresetDrink[]) => void }) {
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false);
  const sheet = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [templates, setTemplates] = useState<Templates | null>(null);
  const [opened, setOpened] = useState<Template | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const covers = useMemo(() => new Map(options.flatMap(option => (option.cover ? [[storeItemKey({ name: option.label, brand: option.brand, flavor: option.flavor }), option.cover] as const] : []))), [options]);

  const load = () => start(async () => {
    const loaded = await storeTemplatesAction().catch(() => null);
    if (loaded) setTemplates(loaded); else setError('Не удалось загрузить шаблоны. Попробуйте ещё раз.');
  });
  function open() {
    setError('');
    sheet.current?.showModal();
    load();
  }
  function save() {
    if (!draft) return;
    const { id, name, drinks, publish } = draft;
    start(async () => {
      const result = await saveStorePresetAction(id ?? null, name, drinks, publish && drinks.length >= MIN_PUBLIC_PRESET_DRINKS).catch(() => ({ error: 'Не удалось сохранить шаблон. Попробуйте ещё раз.' }));
      if ('error' in result) { setError(result.error); return; }
      setTemplates(result);
      setDraft(null);
      setOpened(result.own.find(preset => preset.id === id) ?? null);
      setError('');
    });
  }
  function remove() {
    if (!opened?.id || !window.confirm(`Удалить шаблон «${opened.name}»?`)) return;
    const { id } = opened;
    start(async () => {
      const result = await deleteStorePresetAction(id).catch(() => ({ error: 'Не удалось удалить шаблон. Попробуйте ещё раз.' }));
      if ('error' in result) { setError(result.error); return; }
      setTemplates(result);
      setOpened(null);
      setError('');
    });
  }
  const back = () => { setError(''); if (draft) setDraft(null); else setOpened(null); };
  const title = draft ? (draft.id ? 'Редактировать шаблон' : 'Новый шаблон') : opened?.name ?? 'Шаблоны';
  return <>
    <button type="button" className="catalog-add-button store-templates-button" aria-label="Шаблоны" title="Шаблоны" aria-haspopup="dialog" disabled={disabled} onClick={open}>{LAYERS}</button>
    {mounted && createPortal(<BottomSheet ref={sheet} className="store-templates-sheet" labelledBy={titleId} onClose={() => { setOpened(null); setDraft(null); setError(''); }}>
      <BottomSheetHead id={titleId} title={title} onBack={draft || opened ? back : undefined} onClose={() => sheet.current?.close()}
        actions={opened && !draft ? <TemplateMenu template={opened} staff={templates?.staff ?? false} pending={pending} onDelete={remove} onRemoved={() => { setOpened(null); load(); }}
          onEdit={() => setDraft({ id: opened.id, name: opened.name, drinks: opened.drinks, publish: opened.published ?? false })} /> : undefined} />
      {error && <FormAlert>{error}</FormAlert>}
      {draft ? <TemplateEditor draft={draft} options={options} covers={covers} store={items} pending={pending} onChange={setDraft} onSave={save} />
        : opened ? <TemplateDrinks template={opened} items={items} covers={covers} pending={pending} onAdd={() => { onAdd(opened.name, opened.drinks); sheet.current?.close(); }} /> : <>
          {!templates && !error && <p className="store-template-lead" role="status">Загружаем шаблоны…</p>}
          {templates && <>
            <button type="button" className="tier-create-banner store-template-create" onClick={() => setDraft({ name: '', drinks: [], publish: false })}>
              <span className="tier-create-banner-icon" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg></span>
              <span className="tier-create-banner-copy"><strong>Создай свой шаблон</strong><span>Собери список напитков и поделись с участниками</span></span>
              <svg className="tier-create-banner-arrow" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
            </button>
            <TemplateGroup title="Готовые" rows={templates.ready} covers={covers} onOpen={setOpened} />
            <TemplateGroup title="Мои" rows={templates.own} covers={covers} onOpen={setOpened} />
            <TemplateGroup title="От участников" rows={templates.shared} covers={covers} onOpen={setOpened} />
          </>}
        </>}
    </BottomSheet>, document.body)}
  </>;
}
