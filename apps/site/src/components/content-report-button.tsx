'use client';
import { useActionState, useId, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { reportContentAction } from '@/app/profile/report-actions';
import { FlagIcon } from '@/components/action-icons';
import { BlockMemberButton } from '@/components/block-member-button';
import { CONTENT_REPORT_KINDS, REPORT_REASONS, type ContentReportKind } from '@/lib/profile-report-fields';

/**
 * «Пожаловаться» on someone else's content: opens a dialog with the reason and an optional comment.
 * The report lands in the admin queue together with profile reports. Render only for signed-in viewers
 * who are not the author; the server checks both again. `menuitem` is an item of MoreActions; the dialog lives
 * in a portal so it stays open when that menu hides.
 */
const subscribeNever = () => () => {};
export function ContentReportButton({ kind, id, variant = 'icon' }: { kind: ContentReportKind; id: string; variant?: 'icon' | 'text' | 'menuitem' }) {
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false);
  const dialog = useRef<HTMLDialogElement>(null);
  const fieldId = useId();
  // A new form per opening, so a sent report does not stay on screen next time.
  const [round, setRound] = useState(0);
  const [pagePath, setPagePath] = useState('');
  const label = `Пожаловаться: ${CONTENT_REPORT_KINDS[kind].toLowerCase()}`;
  function open() {
    setPagePath(window.location.pathname + window.location.search);
    setRound(value => value + 1);
    dialog.current?.showModal();
  }
  const modal = <dialog ref={dialog} className="content-report-dialog" aria-labelledby={`${fieldId}-title`}>
    {round > 0 && <ReportForm key={round} kind={kind} id={id} pagePath={pagePath} fieldId={fieldId} onClose={() => dialog.current?.close()} />}
  </dialog>;
  return <>
    {variant === 'icon'
      ? <button className="wall-action-button content-report-button" type="button" aria-label={label} title={label} onClick={open}><FlagIcon /></button>
      : variant === 'menuitem'
        ? <button className="more-actions-item" type="button" role="menuitem" onClick={open}><FlagIcon /><span>Пожаловаться</span></button>
        : <button className="review-comment-reply content-report-button" type="button" aria-label={label} onClick={open}><FlagIcon size={16} /><span>Пожаловаться</span></button>}
    {mounted && createPortal(modal, document.body)}
  </>;
}

function ReportForm({ kind, id, pagePath, fieldId, onClose }: { kind: ContentReportKind; id: string; pagePath: string; fieldId: string; onClose: () => void }) {
  const [state, action, pending] = useActionState(reportContentAction, {});
  return <>
    <h2 id={`${fieldId}-title`}>Пожаловаться</h2>
    <p className="community-muted">{CONTENT_REPORT_KINDS[kind]}. Жалобу увидят только администраторы, автор не узнает, кто её отправил.</p>
    {state.success ? <>
      <p role="status">{state.success}</p>
      {state.author && <div className="content-report-block">
        <p className="community-muted">Не хотите видеть этого участника? После блокировки он не сможет вам отвечать, писать на вашей стене и заказывать у вас, а его записи и комментарии скроются.</p>
        <BlockMemberButton userId={state.author.id} name={state.author.name} initiallyBlocked={state.author.blocked} />
      </div>}
      <div className="content-report-actions"><button className="community-button" type="button" onClick={onClose}>Готово</button></div>
    </> : <form action={action}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="contentId" value={id} />
      <input type="hidden" name="pagePath" value={pagePath} />
      <label htmlFor={`${fieldId}-reason`}>Причина</label>
      <select id={`${fieldId}-reason`} name="reason" required defaultValue="" disabled={pending}>
        <option value="" disabled>Выберите причину</option>
        {Object.entries(REPORT_REASONS).map(([key, text]) => <option key={key} value={key}>{text}</option>)}
      </select>
      <label htmlFor={`${fieldId}-comment`}>Комментарий <span className="community-muted">(необязательно)</span></label>
      <textarea id={`${fieldId}-comment`} name="comment" maxLength={1000} rows={3} placeholder="Что не так?" disabled={pending} />
      {state.error && <p className="field-error" role="alert">{state.error}</p>}
      <div className="content-report-actions">
        <button className="community-button community-button-secondary" type="button" disabled={pending} onClick={onClose}>Отмена</button>
        <button className="community-button" type="submit" disabled={pending}>{pending ? 'Отправляем…' : 'Отправить'}</button>
      </div>
    </form>}
  </>;
}
