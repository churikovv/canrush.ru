'use client';
import { useActionState } from 'react';
import { moderateCatalogDrinkAction } from '@/app/catalog/new/actions';

/** Publish a member's drink or return it with a reason (the author sees it under «Ваши заявки»). */
export function CatalogDrinkModeration({ id, version }: { id: string; version: string }) {
  const [state, action, pending] = useActionState(moderateCatalogDrinkAction.bind(null, id, version), {});
  if (state.saved) return <p role="status">Решение сохранено.</p>;
  return <form action={action} className="store-moderation">
    <label>Комментарий автору<textarea name="note" maxLength={500} rows={2} disabled={pending} placeholder="Например: на фото не видно название вкуса" /></label>
    {state.error && <p className="field-error" role="alert">{state.error}</p>}
    <div className="store-card-actions">
      <button className="community-button" name="status" value="published" disabled={pending}>Опубликовать</button>
      <button className="community-button community-button-secondary" name="status" value="rejected" disabled={pending}>Вернуть на исправление</button>
    </div>
  </form>;
}
