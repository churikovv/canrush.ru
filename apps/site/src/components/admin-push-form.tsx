'use client';
import { useActionState, useState, type MouseEvent } from 'react';
import { sendBroadcastAction } from '@/app/admin/push/actions';
import { FormAlert } from '@/components/form-alert';
import { AUDIENCE_LABELS, BROADCAST_AUDIENCES, BROADCAST_BODY_LIMIT, BROADCAST_PATH_LIMIT, BROADCAST_TITLE_LIMIT, type BroadcastAudience } from '@/lib/push-broadcast-fields';
import type { BroadcastReach } from '@/lib/push-broadcast';

/** The broadcast form with a preview of the push; fields are controlled, so a test keeps the text for the real send. */
export function AdminPushForm({ reach }: { reach: BroadcastReach }) {
  const [state, action, pending] = useActionState(sendBroadcastAction, {});
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [path, setPath] = useState('/');
  const [audience, setAudience] = useState<BroadcastAudience>('all');
  const confirmSend = (event: MouseEvent) => {
    if (!window.confirm(`Отправить «${title.trim()}»: ${reach[audience]} устр. — ${AUDIENCE_LABELS[audience]}? Отменить рассылку будет нельзя.`)) event.preventDefault();
  };
  return <div className="admin-push">
    <form action={action} className="admin-push-form">
      <label>Заголовок
        <input name="title" value={title} onChange={event => setTitle(event.target.value)} maxLength={BROADCAST_TITLE_LIMIT} required disabled={pending} placeholder="Банкомат ждёт" />
        <small>{title.length} из {BROADCAST_TITLE_LIMIT}</small>
      </label>
      <label>Текст
        <textarea name="body" value={body} onChange={event => setBody(event.target.value)} maxLength={BROADCAST_BODY_LIMIT} rows={3} required disabled={pending} placeholder="Сегодня бесплатная крутка уже доступна" />
        <small>{body.length} из {BROADCAST_BODY_LIMIT}</small>
      </label>
      <label>Куда ведёт нажатие
        <input name="path" value={path} onChange={event => setPath(event.target.value)} maxLength={BROADCAST_PATH_LIMIT} disabled={pending} placeholder="/gacha" />
      </label>
      <fieldset disabled={pending}>
        <legend>Кому</legend>
        <div className="admin-push-audiences">{BROADCAST_AUDIENCES.map(item => <label key={item} data-checked={audience === item || undefined}>
          <input type="radio" name="audience" value={item} checked={audience === item} onChange={() => setAudience(item)} />
          <span>{AUDIENCE_LABELS[item]}</span><b>{reach[item]}</b>
        </label>)}</div>
      </fieldset>
      {state.error && <FormAlert>{state.error}</FormAlert>}
      {state.success && <FormAlert tone="success">{state.success}</FormAlert>}
      <div className="admin-push-actions">
        <button className="community-button community-button-secondary" type="submit" name="intent" value="test" disabled={pending}>Отправить себе</button>
        <button className="community-button" type="submit" name="intent" value="send" disabled={pending || !reach[audience]} onClick={confirmSend}>{pending ? 'Отправляем…' : `Отправить · ${reach[audience]}`}</button>
      </div>
    </form>
    <div className="admin-push-preview" aria-label="Как увидят на телефоне">
      <span className="admin-push-preview-label">Как увидят на телефоне</span>
      <div className="admin-push-card">
        <span className="admin-push-card-icon" aria-hidden="true" />
        <div><span className="admin-push-card-app">CanRush</span><strong>{title.trim() || 'Заголовок'}</strong><p>{body.trim() || 'Текст уведомления'}</p></div>
      </div>
    </div>
  </div>;
}
