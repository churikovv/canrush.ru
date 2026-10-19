'use client';
import { useActionState, useState } from 'react';
import { confirmContestAction, drawContestAction, redrawContestAction } from '@/app/admin/contest/actions';
import { eligibleForDraw, type ContestEntry } from '@/lib/contest';

const Feedback = ({ state }: { state: { error?: string; success?: string } }) =>
  <p className={state.error ? 'field-error' : 'community-feedback'} role={state.error ? 'alert' : 'status'}>{state.error ?? state.success}</p>;

/** Draw form: filters show the pool size live; members who did not answer earlier are left out on the server. */
export function ContestDrawForm({ contestKey, entries, closedReason }: { contestKey: string; entries: (ContestEntry & { excluded: boolean })[]; closedReason?: string }) {
  const [filters, setFilters] = useState({ telegram: true, avatar: false });
  const [state, action, pending] = useActionState(drawContestAction.bind(null, contestKey), {});
  const pool = entries.filter(entry => !entry.excluded && eligibleForDraw(entry, filters)).length;
  return <form action={action} className="contest-draw-form" onSubmit={event => { if (!window.confirm(`Провести розыгрыш среди ${pool} участников? Результат сохранится в истории.`)) event.preventDefault(); }}>
    <fieldset disabled={pending}>
      <legend>Кто участвует в розыгрыше</legend>
      <label><input type="checkbox" checked disabled /> Отметил банку в календаре (обязательно)</label>
      <label><input type="checkbox" name="telegram" checked={filters.telegram} onChange={event => setFilters({ ...filters, telegram: event.target.checked })} /> Указал Telegram</label>
      <label><input type="checkbox" name="avatar" checked={filters.avatar} onChange={event => setFilters({ ...filters, avatar: event.target.checked })} /> Поставил аватар</label>
    </fieldset>
    <div className="contest-draw-submit"><strong>В пуле сейчас: {pool}</strong><button className="community-button" type="submit" disabled={pending || !pool || Boolean(closedReason)}>{pending ? 'Выбираем…' : 'Выбрать победителя'}</button>{closedReason && <span className="admin-table-muted">{closedReason}</span>}</div>
    <Feedback state={state} />
  </form>;
}

/** Outcome of contacting the drawn winner: confirm (and give the tag) or draw again without them. */
export function ContestWinnerActions({ contestKey, drawId, tagLabel }: { contestKey: string; drawId: string; tagLabel?: string }) {
  const [confirmed, confirm, confirming] = useActionState(confirmContestAction.bind(null, contestKey), {});
  const [redrawn, redraw, redrawing] = useActionState(redrawContestAction.bind(null, contestKey), {});
  const busy = confirming || redrawing;
  return <div className="contest-winner-actions">
    <form action={confirm} onSubmit={event => { if (!window.confirm(tagLabel ? `Связались с победителем? Он получит тег «${tagLabel}» навсегда.` : 'Связались с победителем?')) event.preventDefault(); }}>
      <input type="hidden" name="drawId" value={drawId} />
      <button className="community-button" type="submit" disabled={busy}>{confirming ? 'Сохраняем…' : tagLabel ? 'Связались — выдать тег' : 'Связались'}</button>
    </form>
    <form action={redraw} onSubmit={event => { if (!window.confirm('Победитель не вышел на связь? Он выбывает из этого конкурса, и мы сразу выберем другого.')) event.preventDefault(); }}>
      <input type="hidden" name="drawId" value={drawId} />
      <button className="community-button community-button-secondary" type="submit" disabled={busy}>{redrawing ? 'Переигрываем…' : 'Не ответил — переиграть'}</button>
    </form>
    <Feedback state={confirmed.error || confirmed.success ? confirmed : redrawn} />
  </div>;
}
