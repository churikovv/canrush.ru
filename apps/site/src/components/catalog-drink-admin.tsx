'use client';
import { useActionState, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import Link from '@/components/navigation-progress';
import { EditIcon, TrashIcon } from '@/components/action-icons';
import { MoreActions } from '@/components/more-actions';
import { CatalogDrinkBrandInput, CatalogDrinkFlavorInput, type PickedFlavor } from '@/components/catalog-drink-flavor-input';
import { SUGAR_OPTIONS } from '@/components/catalog-drink-form';
import { deleteCatalogDrinkAction, updateCatalogDrinkAction } from '@/app/catalog/new/actions';
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
  const titleId = useId();
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
  return <>
    <MoreActions label={`Действия: ${label}`}>
      <button className="more-actions-item" type="button" role="menuitem" onClick={() => { setRound(value => value + 1); dialog.current?.showModal(); }}><EditIcon /><span>Редактировать</span></button>
      <form action={remove}>
        <button className="more-actions-item is-danger" type="submit" role="menuitem" disabled={deleting} onClick={confirmDelete}><TrashIcon /><span>{deleting ? 'Удаляем…' : 'Удалить'}</span></button>
      </form>
    </MoreActions>
    {deleted.error && <p className="field-error admin-drink-card-error" role="alert">{deleted.error}</p>}
    {mounted && createPortal(modal, document.body)}
  </>;
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
      {(problem || state.error) && <p className="field-error" role="alert">{problem || state.error}{!problem && state.duplicate && <> <Link href={state.duplicate}>Открыть карточку</Link></>}</p>}
      <div className="store-card-actions">
        <button className="community-button" type="submit" disabled={!picked.length || brand.trim().length < 2}>{pending ? 'Сохраняем…' : 'Сохранить'}</button>
        <button className="community-button community-button-secondary" type="button" onClick={onDone}>Отмена</button>
      </div>
    </fieldset>
  </form>;
}
