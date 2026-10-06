'use client';
import { useActionState, useId } from 'react';
import { reportProfileAction } from '@/app/profile/report-actions';
import { REPORT_REASONS } from '@/lib/profile-report-fields';

export function ProfileReportForm({ targetId }: { targetId: string }) {
  const [state, action, pending] = useActionState(reportProfileAction, {});
  const id = useId();
  return <details className="profile-report">
    <summary>Пожаловаться на профиль</summary>
    {state.success ? <p role="status">{state.success}</p> : <form action={action}>
      <input type="hidden" name="targetId" value={targetId} />
      <label htmlFor={id + '-reason'}>Причина жалобы</label>
      <select id={id + '-reason'} name="reason" required defaultValue="" disabled={pending}>
        <option value="" disabled>Выберите причину</option>
        {Object.entries(REPORT_REASONS).map(([key,label]) => <option key={key} value={key}>{label}</option>)}
      </select>
      <label htmlFor={id + '-comment'}>Комментарий <span className="community-muted">(необязательно)</span></label>
      <textarea id={id + '-comment'} name="comment" maxLength={1000} rows={4} placeholder="Расскажите, что произошло" disabled={pending} />
      <p className="community-muted">До 1000 символов. Жалобу увидят только администраторы.</p>
      {state.error && <p className="field-error" role="alert">{state.error}</p>}
      <button type="submit" className="community-button community-button-secondary" disabled={pending}>{pending ? 'Отправляем…' : 'Отправить жалобу'}</button>
    </form>}
  </details>;
}
