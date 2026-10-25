'use client';
import { useActionState, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, useTransition, type FormEvent, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import Link from '@/components/navigation-progress';
import { FormAlert } from '@/components/form-alert';
import { EditIcon, TrashIcon } from '@/components/action-icons';
import { MoreActions } from '@/components/more-actions';
import { CatalogDrinkBrandInput, CatalogDrinkFlavorInput, type PickedFlavor } from '@/components/catalog-drink-flavor-input';
import { SUGAR_OPTIONS } from '@/components/catalog-drink-form';
import { deleteCatalogDrinkAction, mergeCatalogDrinkAction, searchMergeTargetsAction, updateCatalogDrinkAction } from '@/app/catalog/new/actions';
import { MAX_DRINK_FULL_NAME, MAX_DRINK_INGREDIENTS, splitDrinkFlavorKey, type DrinkSugar } from '@/lib/catalog-drink-fields';
import type { CatalogDrink } from '@/lib/catalog-drinks';

export type AdminDrink = Pick<CatalogDrink, 'id' | 'brand' | 'flavor' | 'name' | 'fullName' | 'volumes' | 'ingredients' | 'status' | 'photo'> & { version: string };
type Options = { brands: string[]; flavors: { key: string; label: string }[] };
const subscribeNever = () => () => {};

/**
 * «⋯» on an admin drink card: «Редактировать» opens a dialog (in a portal, so it outlives the closed menu),
 * «Удалить» asks first. Deleting a published drink takes it out of the catalog.
 */
export function CatalogDrinkAdminMenu({ drink, brands, flavors }: { drink: AdminDrink } & Options) {
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false);
  const dialog = useRef<HTMLDialogElement>(null);
  const mergeDialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const mergeTitleId = useId();
  const [mergeRound, setMergeRound] = useState(0);
  // A fresh form per opening: what was typed and not saved does not come back.
  const [round, setRound] = useState(0);
  const [deleted, remove, deleting] = useActionState(deleteCatalogDrinkAction.bind(null, drink.id), {});
  const label = `${drink.brand} · ${drink.name}`;
  function confirmDelete(event: MouseEvent<HTMLButtonElement>) {
    const message = drink.status === 'published'
      ? `Удалить «${label}» из каталога? Отзывы и отметки останутся, но карточка напитка пропадёт.`
      : `Удалить заявку «${label}»?`;
    if (!window.confirm(message)) event.preventDefault();
  }
  const modal = <dialog ref={dialog} className="content-report-dialog admin-drink-dialog" aria-labelledby={titleId} onClose={() => setRound(0)}>
    {round > 0 && <EditForm key={round} drink={drink} brands={brands} flavors={flavors} titleId={titleId} onDone={() => dialog.current?.close()} />}
  </dialog>;
  const mergeModal = <dialog ref={mergeDialog} className="content-report-dialog admin-drink-dialog" aria-labelledby={mergeTitleId} onClose={() => setMergeRound(0)}>
    {mergeRound > 0 && <MergeForm key={mergeRound} drink={drink} titleId={mergeTitleId} onDone={() => mergeDialog.current?.close()} />}
  </dialog>;
  return <>
    <MoreActions label={`Действия: ${label}`}>
      <button className="more-actions-item" type="button" role="menuitem" onClick={() => { setRound(value => value + 1); dialog.current?.showModal(); }}><EditIcon /><span>Редактировать</span></button>
      <button className="more-actions-item" type="button" role="menuitem" onClick={() => { setMergeRound(value => value + 1); mergeDialog.current?.showModal(); }}><MergeIcon /><span>Склеить с…</span></button>
      <form action={remove}>
        <button className="more-actions-item is-danger" type="submit" role="menuitem" disabled={deleting} onClick={confirmDelete}><TrashIcon /><span>{deleting ? 'Удаляем…' : 'Удалить'}</span></button>
      </form>
    </MoreActions>
    {deleted.error && <p className="field-error admin-drink-card-error" role="alert">{deleted.error}</p>}
    {mounted && createPortal(<>{modal}{mergeModal}</>, document.body)}
  </>;
}

function MergeIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 4v5a5 5 0 0 0 5 5h7M18 14l-3-3m3 3-3 3M6 20v-3" /></svg>;
}

type MergeTarget = { brand: string; flavor: string; label: string; cover?: string };

/**
 * «Склеить с…»: pick the catalog card this drink duplicates. A published drink's reviews, favourites, tier lists,
 * calendar and swipes move there and its address redirects; the drink is deleted, and the 50 XP paid for it are taken
 * back unless the box is cleared. The author gets a notification either way.
 */
function MergeForm({ drink, titleId, onDone }: { drink: AdminDrink; titleId: string; onDone: () => void }) {
  const [state, action, pending] = useActionState(mergeCatalogDrinkAction.bind(null, drink.id, drink.version), {});
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MergeTarget[]>([]);
  const [target, setTarget] = useState<MergeTarget | null>(null);
  const [searching, startSearch] = useTransition();
  const listId = useId();
  const published = drink.status === 'published';
  // Results of an emptied search are not shown, so they need no clearing.
  const shown = query.trim() ? results : [];
  useEffect(() => { if (state.saved) onDone(); }, [state.saved, onDone]);
  useEffect(() => {
    const typed = query.trim();
    if (!typed) return;
    const timer = window.setTimeout(() => startSearch(async () => {
      setResults(await searchMergeTargetsAction(typed, { brand: drink.brand, flavor: drink.flavor }));
    }), 250);
    return () => window.clearTimeout(timer);
  }, [query, drink.brand, drink.flavor]);
  function confirmMerge(event: FormEvent<HTMLFormElement>) {
    if (!target) { event.preventDefault(); return; }
    if (!window.confirm(`Склеить «${drink.brand} · ${drink.name}» с «${target.label}»? Напиток участника будет удалён${published ? ', отзывы и отметки переедут' : ''}.`)) event.preventDefault();
  }
  return <form action={action} onSubmit={confirmMerge} className="store-form admin-drink-edit-form admin-drink-merge">
    <h2 id={titleId}>Склеить с другой карточкой</h2>
    <p className="field-help">{published
      ? `«${drink.brand} · ${drink.name}» — дубль? Его отзывы, избранное, тирлисты, календарь и свайпы переедут на выбранную карточку, старый адрес будет вести на неё, а сам напиток удалится. Автор получит уведомление.`
      : `Заявка «${drink.brand} · ${drink.name}» удалится как дубль выбранной карточки. Автор получит уведомление.`}</p>
    <fieldset disabled={pending}>
      <label>Карточка каталога<input type="search" value={query} onChange={event => { setQuery(event.target.value); setTarget(null); }} placeholder="Бренд, вкус или название" autoComplete="off" aria-controls={listId} /></label>
      {target && <input type="hidden" name="targetBrand" value={target.brand} />}
      {target && <input type="hidden" name="targetFlavor" value={target.flavor} />}
      <ul className="admin-merge-results" id={listId} aria-busy={searching}>
        {shown.map(option => <li key={`${option.brand}:${option.flavor}`}>
          <button type="button" aria-pressed={target?.brand === option.brand && target.flavor === option.flavor} onClick={() => setTarget(option)}>
            <span className="admin-merge-cover">{option.cover ? <Image src={option.cover} width={40} height={40} unoptimized alt="" /> : null}</span>
            <span>{option.label}</span>
          </button>
        </li>)}
        {query.trim() && !searching && !results.length && <li className="field-help">Ничего не нашлось.</li>}
      </ul>
      {published && <label className="admin-merge-revoke"><input type="checkbox" name="revokeXp" defaultChecked />Забрать 50 XP у автора за дубль</label>}
      {state.error && <FormAlert>{state.error}</FormAlert>}
      <div className="store-card-actions">
        <button className="community-button" type="submit" disabled={!target}>{pending ? 'Склеиваем…' : target ? `Склеить с «${target.label}»` : 'Выберите карточку'}</button>
        <button className="community-button community-button-secondary" type="button" onClick={onDone}>Отмена</button>
      </div>
    </fieldset>
  </form>;
}

/** The edit form: the request's brand, flavour and sugar inputs, then photo, full name, volumes and the label text. */
function EditForm({ drink, brands, flavors, titleId, onDone }: { drink: AdminDrink; titleId: string; onDone: () => void } & Options) {
  const [state, action, pending] = useActionState(updateCatalogDrinkAction.bind(null, drink.id, drink.version), {});
  const initial = useMemo(() => {
    const { parts, sugar } = splitDrinkFlavorKey(drink.flavor);
    const picked = parts.map((part): PickedFlavor => {
      const known = flavors.find(flavor => flavor.key === part);
      return known ? { key: known.key, label: known.label, own: false } : { key: part, label: part, own: true };
    });
    return { picked, sugar };
  }, [drink.flavor, flavors]);
  const [brand, setBrand] = useState(drink.brand);
  const [picked, setPicked] = useState<PickedFlavor[]>(initial.picked);
  const [sugar, setSugar] = useState<DrinkSugar>(initial.sugar);
  const [problem, setProblem] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const preview = useMemo(() => photo ? URL.createObjectURL(photo) : '', [photo]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => { if (state.saved) onDone(); }, [state.saved, onDone]);
  const id = `admin-drink-${drink.id}`;
  return <form action={action} className="store-form admin-drink-edit-form">
    <h2 id={titleId}>Редактировать напиток</h2>
    {drink.status === 'published' && <p className="field-help">Если поменять бренд или вкус, отзывы, избранное, тирлисты, календарь и свайпы переедут на новую карточку, а старый адрес будет вести на неё.</p>}
    <fieldset disabled={pending}>
      <div className="admin-drink-edit-photo">
        <Image src={preview || drink.photo} width={72} height={90} unoptimized alt="" />
        <label>Новое фото банки<input type="file" name="photos" accept="image/jpeg,image/png,image/webp" onChange={event => setPhoto(event.target.files?.[0] ?? null)} /></label>
      </div>
      <div className="form-field">
        <label className="catalog-flavor-label" htmlFor={`${id}-brand`}>Бренд</label>
        <CatalogDrinkBrandInput inputId={`${id}-brand`} brands={brands} value={brand} onChange={setBrand} />
      </div>
      <div className="form-field">
        <label className="catalog-flavor-label" htmlFor={`${id}-flavor`}>Вкус</label>
        <CatalogDrinkFlavorInput inputId={`${id}-flavor`} flavors={flavors} value={picked} onChange={setPicked} onProblem={setProblem} />
      </div>
      <fieldset className="catalog-drink-sugar">
        <legend className="catalog-flavor-label">Сахар</legend>
        {SUGAR_OPTIONS.map(option => <label key={option.value} className="catalog-drink-sugar-option">
          <input type="radio" name="sugar" value={option.value} checked={sugar === option.value} onChange={() => setSugar(option.value)} />
          <span><b>{option.title}</b><small>{option.hint}</small></span>
        </label>)}
      </fieldset>
      <label>Полное название<input name="fullName" defaultValue={drink.fullName} maxLength={MAX_DRINK_FULL_NAME} placeholder="Monster Ultra Paradise" /></label>
      <label>Объёмы, мл<input name="volumes" defaultValue={drink.volumes.join(', ')} required inputMode="numeric" placeholder="250, 450" /></label>
      <label>Состав<textarea name="ingredients" rows={4} maxLength={MAX_DRINK_INGREDIENTS} defaultValue={drink.ingredients} /></label>
      {(problem || state.error) && <FormAlert actions={!problem && state.duplicate ? <Link href={state.duplicate}>Открыть карточку</Link> : undefined}>{problem || state.error}</FormAlert>}
      <div className="store-card-actions">
        <button className="community-button" type="submit" disabled={!picked.length || brand.trim().length < 2}>{pending ? 'Сохраняем…' : 'Сохранить'}</button>
        <button className="community-button community-button-secondary" type="button" onClick={onDone}>Отмена</button>
      </div>
    </fieldset>
  </form>;
}
