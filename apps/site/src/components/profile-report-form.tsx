'use client';
import { useActionState, useId, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { reportProfileAction } from '@/app/profile/report-actions';
import { FlagIcon } from '@/components/action-icons';
import { REPORT_REASONS } from '@/lib/profile-report-fields';
import { FormAlert } from '@/components/form-alert';

const subscribeNever = () => () => {};

/**
 * «Пожаловаться» on a profile: an item of the profile's «⋯» menu (MoreActions) that opens a dialog with the reason
 * and an optional comment. The dialog lives in a portal so it stays open when the menu hides.
 */
export function ProfileReportMenuItem({ targetId }: { targetId: string }) {
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false);
  const dialog = useRef<HTMLDialogElement>(null);
  const fieldId = useId();
  // A new form per opening, so a sent report does not stay on screen next time.
  const [round, setRound] = useState(0);
  function open() { setRound(value => value + 1); dialog.current?.showModal(); }
  const modal = <dialog ref={dialog} className="content-report-dialog" aria-labelledby={`${fieldId}-title`}>
    {round > 0 && <ReportForm key={round} targetId={targetId} fieldId={fieldId} onClose={() => dialog.current?.close()} />}
  </dialog>;
  return <>
    <button className="more-actions-item" type="button" role="menuitem" onClick={open}><FlagIcon /><span>Пожаловаться</span></button>
    {mounted && createPortal(modal, document.body)}
  </>;
}

function ReportForm({ targetId, fieldId, onClose }: { targetId: string; fieldId: string; onClose: () => void }) {
  const [state, action, pending] = useActionState(reportProfileAction, {});
  return <>
    <h2 id={`${fieldId}-title`}>Пожаловаться на профиль</h2>
    <p className="community-muted">Жалобу увидят только администраторы, участник не узнает, кто её отправил.</p>
    {state.success ? <>
      <p role="status">{state.success}</p>
      <div className="content-report-actions"><button className="community-button" type="button" onClick={onClose}>Готово</button></div>
    </> : <form action={action}>
      <input type="hidden" name="targetId" value={targetId} />
      <label htmlFor={`${fieldId}-reason`}>Причина</label>
      <select id={`${fieldId}-reason`} name="reason" required defaultValue="" disabled={pending}>
        <option value="" disabled>Выберите причину</option>
        {Object.entries(REPORT_REASONS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select>
      <label htmlFor={`${fieldId}-comment`}>Комментарий <span className="community-muted">(необязательно)</span></label>
      <textarea id={`${fieldId}-comment`} name="comment" maxLength={1000} rows={3} placeholder="Расскажите, что произошло" disabled={pending} />
      {state.error && <FormAlert>{state.error}</FormAlert>}
      <div className="content-report-actions">
        <button className="community-button community-button-secondary" type="button" disabled={pending} onClick={onClose}>Отмена</button>
        <button className="community-button" type="submit" disabled={pending}>{pending ? 'Отправляем…' : 'Отправить'}</button>
      </div>
    </form>}
  </>;
}
