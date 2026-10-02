'use client';

import { useActionState, useState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { updateCommunityAction } from '@/app/profile/community-actions';
import { PROFILE_ACHIEVEMENTS, type AchievementProgress } from '@/lib/profile-achievements';

function Submit({ children, className = '', disabled = false }: { children: ReactNode; className?: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return <button className={`community-button ${className}`} type="submit" disabled={pending || disabled}>{pending ? 'Сохраняем…' : children}</button>;
}

export function CommunityForm({ children, className = '' }: { children: ReactNode; className?: string }) {
  const [state, action] = useActionState(updateCommunityAction, {});
  return <form action={action} className={`community-form ${className}`}>
    {children}
    <p className={state.error ? 'field-error' : 'community-feedback'} role={state.error ? 'alert' : 'status'}>{state.error ?? state.success}</p>
  </form>;
}

export function FollowControl({ targetId, following, mutual }: { targetId: string; following: boolean; mutual: boolean }) {
  return <CommunityForm>
    <input type="hidden" name="operation" value={following ? 'unfollow' : 'follow'} />
    <input type="hidden" name="targetId" value={targetId} />
    <Submit className={following ? 'community-button-secondary' : ''}>{following ? 'Отписаться' : mutual ? 'Подписаться в ответ' : 'Подписаться'}</Submit>
    {following && mutual && <span className="community-friend-label">Вы друзья</span>}
    {!following && mutual && <span className="community-muted">Подписан на вас</span>}
  </CommunityForm>;
}

export function AchievementPicker({ earned, selected, progress, isOwn }: { earned: string[]; selected: string[]; progress: AchievementProgress; isOwn: boolean }) {
  const [tag, setTag] = useState(selected[0] ?? '');
  return <CommunityForm className="achievement-form">
    <input type="hidden" name="operation" value="tags" />
    {tag && <input type="hidden" name="tags" value={tag} />}
    <div className="achievement-list" role={isOwn ? 'radiogroup' : undefined} aria-label={isOwn ? 'Тег в профиле и отзывах' : undefined}>
      {isOwn && <label className="achievement-option"><input type="radio" name="tag-choice" value="" checked={!tag} onChange={() => setTag('')} /><span className="achievement-copy"><strong>Без тега</strong></span></label>}
      {PROFILE_ACHIEVEMENTS.map(item => {
        const unlocked = earned.includes(item.key);
        const checked = tag === item.key;
        return <label className={`achievement-option${unlocked ? ' is-earned' : ''}`} key={item.key}>
          {isOwn && <input type="radio" name="tag-choice" value={item.key} checked={checked} disabled={!unlocked}
            onChange={() => setTag(item.key)} />}
          <span className="achievement-copy"><strong>{item.label}</strong><span>{item.description}</span></span>
          <span className="achievement-progress">{item.key === 'admin' ? (unlocked ? 'Доступен' : 'Только админ') : unlocked ? 'Получен' : `${Math.min(progress[item.metric], item.goal)} / ${item.goal}`}</span>
        </label>;
      })}
    </div>
    {isOwn && <div className="community-form-footer"><span className="community-muted">{tag ? 'Выбран 1 тег' : 'Тег не выбран'}</span><Submit>Сохранить тег</Submit></div>}
  </CommunityForm>;
}

export function WallComposer({ targetId }: { targetId: string }) {
  const [text, setText] = useState('');
  const [state, action] = useActionState(async (previous: { error?: string; success?: string }, form: FormData) => {
    const next = await updateCommunityAction(previous, form);
    if (!next.error) setText('');
    return next;
  }, {});
  return <form action={action} className="wall-composer">
    <input type="hidden" name="operation" value="comment" /><input type="hidden" name="targetId" value={targetId} />
    <label htmlFor="wall-text" className="sr-only">Комментарий на стене</label>
    <textarea id="wall-text" name="text" value={text} onChange={event => setText(event.target.value)} placeholder="Напишите на стене…" maxLength={1000} rows={3} required />
    <div className="community-form-footer"><span className="community-muted">{text.length} / 1000</span><Submit disabled={!text.trim()}>Отправить</Submit></div>
    <p role={state.error ? 'alert' : 'status'} className={state.error ? 'field-error' : 'community-feedback'}>{state.error ?? state.success}</p>
  </form>;
}

export function DeleteWallComment({ id }: { id: string }) {
  return <CommunityForm className="wall-delete"><input type="hidden" name="operation" value="delete-comment" /><input type="hidden" name="commentId" value={id} /><Submit className="community-button-text">Удалить</Submit></CommunityForm>;
}

export function PresenceSetting({ visible }: { visible: boolean }) {
  return <CommunityForm className="presence-setting"><input type="hidden" name="operation" value="visibility" /><input type="hidden" name="visible" value={visible ? 'false' : 'true'} /><span className="community-muted">Статус в сети: {visible ? 'виден всем' : 'скрыт'}</span><Submit className="community-button-text">{visible ? 'Скрыть статус' : 'Показывать статус'}</Submit></CommunityForm>;
}
