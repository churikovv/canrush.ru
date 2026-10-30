'use client';
import { useActionState, useState, type MouseEvent } from 'react';
import { createGiveawayAction } from '@/app/admin/giveaways/actions';
import { FormAlert } from '@/components/form-alert';
import { SpinGiveawayBanner } from '@/components/spin-giveaway-banner';
import { GIVEAWAY_BODY_LIMIT, GIVEAWAY_DEFAULT_VIEW, GIVEAWAY_MAX_CLAIMS, GIVEAWAY_MAX_SPINS, GIVEAWAY_MAX_VIEW, GIVEAWAY_MIN_VIEW, GIVEAWAY_TITLE_LIMIT, spinsWord } from '@/lib/spin-giveaway-fields';

/** A new giveaway with a live copy of the banner. Dates are Moscow time; the server passes the defaults, so they match on hydration. */
export function AdminGiveawayForm({ start, end }: { start: string; end: string }) {
  const [state, action, pending] = useActionState(createGiveawayAction, {});
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [spins, setSpins] = useState(1);
  const [viewSeconds, setViewSeconds] = useState(GIVEAWAY_DEFAULT_VIEW);
  const [maxClaims, setMaxClaims] = useState('');
  const limit = Number(maxClaims) || 0;
  const confirmCreate = (event: MouseEvent) => {
    const reach = limit ? `до ${limit * spins} ${spinsWord(limit * spins)} первым ${limit} участникам` : 'без лимита участников';
    if (!window.confirm(`Запустить «${title.trim()}»: по ${spins} ${spinsWord(spins)}, ${reach}? Выданные крутки не отзываются.`)) event.preventDefault();
  };
  return <div className="admin-push">
    <form action={action} className="admin-push-form">
      <label>Заголовок
        <input name="title" value={title} onChange={event => setTitle(event.target.value)} maxLength={GIVEAWAY_TITLE_LIMIT} required disabled={pending} placeholder="Крутки за просмотр" />
        <small>{title.length} из {GIVEAWAY_TITLE_LIMIT}</small>
      </label>
      <label>Текст
        <textarea name="body" value={body} onChange={event => setBody(event.target.value)} maxLength={GIVEAWAY_BODY_LIMIT} rows={2} required disabled={pending} placeholder="Подержите баннер на экране — крутки ваши" />
        <small>{body.length} из {GIVEAWAY_BODY_LIMIT}</small>
      </label>
      <div className="admin-giveaway-row">
        <label>Круток каждому
          <input name="spins" type="number" inputMode="numeric" min={1} max={GIVEAWAY_MAX_SPINS} value={spins} onChange={event => setSpins(Math.max(0, Number(event.target.value)))} required disabled={pending} />
        </label>
        <label>Секунд просмотра
          <input name="viewSeconds" type="number" inputMode="numeric" min={GIVEAWAY_MIN_VIEW} max={GIVEAWAY_MAX_VIEW} value={viewSeconds} onChange={event => setViewSeconds(Math.max(0, Number(event.target.value)))} required disabled={pending} />
        </label>
        <label>Первым участникам
          <input name="maxClaims" type="number" inputMode="numeric" min={1} max={GIVEAWAY_MAX_CLAIMS} value={maxClaims} onChange={event => setMaxClaims(event.target.value)} disabled={pending} placeholder="Без лимита" />
        </label>
      </div>
      <div className="admin-giveaway-row is-dates">
        <label>Начало, Москва<input name="startsAt" type="datetime-local" defaultValue={start} required disabled={pending} /></label>
        <label>Конец, Москва<input name="endsAt" type="datetime-local" defaultValue={end} required disabled={pending} /></label>
      </div>
      {state.error && <FormAlert>{state.error}</FormAlert>}
      {state.success && <FormAlert tone="success">{state.success}</FormAlert>}
      <div className="admin-push-actions">
        <button className="community-button" type="submit" disabled={pending} onClick={confirmCreate}>{pending ? 'Создаём…' : 'Запустить раздачу'}</button>
      </div>
    </form>
    <div className="admin-push-preview" aria-label="Как увидят в ленте">
      <span className="admin-push-preview-label">Как увидят в ленте</span>
      <SpinGiveawayBanner preview signedIn giveaway={{ id: 'preview', title: title.trim() || 'Крутки за просмотр', body: body.trim() || 'Подержите баннер на экране — крутки ваши', spins: Math.min(GIVEAWAY_MAX_SPINS, Math.max(1, spins)), viewSeconds: Math.max(1, viewSeconds), taken: false }} />
    </div>
  </div>;
}
