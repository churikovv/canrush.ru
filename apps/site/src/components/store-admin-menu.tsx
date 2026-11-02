'use client';
import { useActionState, useId, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { deleteStoreAction, returnStoreAction } from '@/app/market/stores/actions';
import { TrashIcon } from '@/components/action-icons';
import { BottomSheet, BottomSheetHead } from '@/components/bottom-sheet';
import { FormAlert } from '@/components/form-alert';
import { MoreActions } from '@/components/more-actions';

type Mode = 'return' | 'delete';
const subscribeNever = () => () => {};
const COPY = {
  return: { title: 'Вернуть в черновики', lead: 'пропадёт из каталога и вернётся автору: он поправит магазин и снова отправит на проверку. Опыт и ценники за него останутся, а повторная публикация не начислит их второй раз.', label: 'Что исправить', submit: 'Вернуть автору', pending: 'Возвращаем…', done: 'Магазин возвращён автору.' },
  delete: { title: 'Удалить магазин', lead: 'удалится вместе с фото, отменить это нельзя. Опыт и ценники за него останутся у автора.', label: 'Причина', submit: 'Удалить', pending: 'Удаляем…', done: 'Магазин удалён.' },
} as const;

function TakedownForm({ id, name, version, mode, titleId, onCancel }: { id: string; name: string; version: string; mode: Mode; titleId: string; onCancel: () => void }) {
  const [state, action, pending] = useActionState((mode === 'return' ? returnStoreAction : deleteStoreAction).bind(null, id, version), {});
  const copy = COPY[mode];
  return <>
    <BottomSheetHead id={titleId} title={copy.title} onClose={onCancel} />
    {state.saved ? <p role="status">{copy.done}</p> : <>
      <p className="store-takedown-lead">«{name}» {copy.lead}</p>
      <form action={action} className="store-moderation">
        <label>{copy.label}<textarea name="note" rows={3} maxLength={500} required disabled={pending} /></label>
        <p className="community-muted">Автор увидит этот текст в уведомлении.</p>
        {state.error && <FormAlert>{state.error}</FormAlert>}
        <div className="store-card-actions">
          <button className="community-button" type="submit" disabled={pending}>{pending ? copy.pending : copy.submit}</button>
          <button className="community-button community-button-secondary" type="button" disabled={pending} onClick={onCancel}>Отмена</button>
        </div>
      </form>
    </>}
  </>;
}

/**
 * «⋯» on a store in /admin/stores: a published store goes back to its owner as a draft, any store can be deleted. Both
 * ask for a reason, the owner gets it in a notification. The sheet lives in a portal, so it outlives the closed menu.
 */
export function StoreAdminMenu({ id, name, version, published }: { id: string; name: string; version: string; published: boolean }) {
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  // A fresh form per opening: what was typed and not sent does not come back.
  const [opening, setOpening] = useState<{ mode: Mode; round: number } | null>(null);
  const open = (mode: Mode) => { setOpening(value => ({ mode, round: (value?.round ?? 0) + 1 })); dialog.current?.showModal(); };
  return <>
    <MoreActions label={`Действия: ${name}`}>
      {published && <button className="more-actions-item" type="button" role="menuitem" onClick={() => open('return')}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></svg>
        <span>Вернуть в черновики</span>
      </button>}
      <button className="more-actions-item is-danger" type="button" role="menuitem" onClick={() => open('delete')}><TrashIcon /><span>Удалить</span></button>
    </MoreActions>
    {mounted && createPortal(<BottomSheet ref={dialog} labelledBy={titleId} onClose={() => setOpening(null)}>
      {opening && <TakedownForm key={opening.round} id={id} name={name} version={version} mode={opening.mode} titleId={titleId} onCancel={() => dialog.current?.close()} />}
    </BottomSheet>, document.body)}
  </>;
}
