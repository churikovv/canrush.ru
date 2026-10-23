'use client';
import { useActionState, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from '@/components/navigation-progress';
import { AdminActionButton } from '@/components/admin-action-button';
import { deleteCatalogDrinkAction, updateCatalogDrinkAction } from '@/app/catalog/new/actions';
import { MAX_DRINK_FULL_NAME, MAX_DRINK_INGREDIENTS } from '@/lib/catalog-drink-fields';
import type { CatalogDrink } from '@/lib/catalog-drinks';

type Editable = Pick<CatalogDrink, 'id' | 'brand' | 'flavor' | 'fullName' | 'volumes' | 'ingredients' | 'status' | 'photo'> & { version: string };

/**
 * The admin's edit of one drink, folded under «Редактировать»: photo, full name, volumes and label text for every drink,
 * brand and flavour key only until it is published (reviews and the calendar hang on a published drink's identity).
 */
export function CatalogDrinkAdminEdit({ drink }: { drink: Editable }) {
  const [state, action, pending] = useActionState(updateCatalogDrinkAction.bind(null, drink.id, drink.version), {});
  const [photo, setPhoto] = useState<File | null>(null);
  const preview = useMemo(() => photo ? URL.createObjectURL(photo) : '', [photo]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const identityLocked = drink.status === 'published';
  return <details className="admin-drink-edit">
    <summary>Редактировать</summary>
    <form action={action} className="store-form admin-drink-edit-form">
      <fieldset disabled={pending}>
        <div className="admin-drink-edit-photo">
          <Image src={preview || drink.photo} width={96} height={120} unoptimized alt="" />
          <label>Новое фото банки<input type="file" name="photos" accept="image/jpeg,image/png,image/webp" onChange={event => setPhoto(event.target.files?.[0] ?? null)} /></label>
        </div>
        {identityLocked
          ? <p className="field-help">Бренд и вкус опубликованного напитка не меняются: к ним привязаны отзывы, календарь и тирлисты.</p>
          : <div className="admin-drink-edit-row">
            <label>Бренд<input name="brand" defaultValue={drink.brand} required minLength={2} maxLength={40} /></label>
            <label>Ключ вкуса<input name="flavor" defaultValue={drink.flavor} required maxLength={120} aria-describedby={`flavor-help-${drink.id}`} /></label>
            <p className="field-help" id={`flavor-help-${drink.id}`}>Как у каталога: <code>mango</code>, <code>blend:mango+peach</code>, своё название, <code>:sugarfree</code> на конце для без сахара.</p>
          </div>}
        <label>Полное название<input name="fullName" defaultValue={drink.fullName} maxLength={MAX_DRINK_FULL_NAME} placeholder="Monster Ultra Paradise" /></label>
        <label>Объёмы, мл<input name="volumes" defaultValue={drink.volumes.join(', ')} required inputMode="numeric" placeholder="250, 450" /></label>
        <label>Состав<textarea name="ingredients" rows={4} maxLength={MAX_DRINK_INGREDIENTS} defaultValue={drink.ingredients} /></label>
        {state.error && <p className="field-error" role="alert">{state.error}{state.duplicate && <> <Link href={state.duplicate}>Открыть карточку</Link></>}</p>}
        {state.saved && !pending && <p role="status">Сохранено.</p>}
        <div className="store-card-actions"><button className="community-button" type="submit">{pending ? 'Сохраняем…' : 'Сохранить'}</button></div>
      </fieldset>
    </form>
  </details>;
}

/** Deletes a drink after a confirmation; a published one leaves the catalog. */
export function CatalogDrinkAdminDelete({ id, label, published }: { id: string; label: string; published: boolean }) {
  const [state, action] = useActionState(deleteCatalogDrinkAction.bind(null, id), {});
  if (state.saved) return <p role="status">Напиток удалён.</p>;
  return <form action={action} className="admin-drink-delete">
    <AdminActionButton variant="danger" pendingLabel="Удаляем…" confirmMessage={published
      ? `Удалить «${label}» из каталога? Отзывы и отметки останутся, но карточка напитка пропадёт.`
      : `Удалить заявку «${label}»?`}>Удалить</AdminActionButton>
    {state.error && <p className="field-error" role="alert">{state.error}</p>}
  </form>;
}
