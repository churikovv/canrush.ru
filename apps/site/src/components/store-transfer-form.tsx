'use client';
import { useActionState } from 'react';
import { transferStoreAction } from '@/app/admin/actions';

/** Admin form that hands a store to another member; with `storeId` it is bound to that store. */
export function StoreTransferForm({ storeId }: { storeId?: string }) {
  const [state, action, pending] = useActionState(transferStoreAction, {});
  return <form action={action} className="store-transfer-form">
    {storeId ? <input type="hidden" name="store" value={storeId} />
      : <label>Магазин<input name="store" required maxLength={300} placeholder="Ссылка на магазин или его ID" autoComplete="off" spellCheck={false} disabled={pending} /></label>}
    <label>Новый владелец<input name="owner" required maxLength={300} placeholder="Почта, @юзернейм или ссылка на профиль" autoComplete="off" spellCheck={false} disabled={pending} /></label>
    <button className="community-button" type="submit" disabled={pending}>{pending ? 'Передаём…' : 'Передать'}</button>
    <p className={state.error ? 'field-error' : 'community-feedback'} role={state.error ? 'alert' : 'status'}>{state.error ?? state.success}</p>
  </form>;
}
