'use client';
import { MentionTextarea } from '@/components/mention-textarea';
import { MediaAttachButton, MediaAttachmentPreviews, useMediaAttachments } from '@/components/media-attachments';
import { TrashIcon } from '@/components/action-icons';

import { useActionState, useState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { updateCommunityAction } from '@/app/profile/community-actions';
import { MAX_WALL_MEDIA } from '@/lib/wall-media-limits';
export { AchievementPicker } from '@/components/profile-tag-picker';

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
    <Submit className={following ? 'community-button-secondary' : ''}>{following ? (mutual ? 'Удалить из друзей' : 'Отписаться') : mutual ? 'Подписаться в ответ' : 'Подписаться'}</Submit>
    {!following && mutual && <span className="community-muted">Подписан на вас</span>}
  </CommunityForm>;
}

export function WallComposer({ targetId, label = 'Комментарий на стене', placeholder = 'Напишите на стене…' }: { targetId: string; label?: string; placeholder?: string }) {
  const [text, setText] = useState('');
  const media = useMediaAttachments();
  const [state, action, pending] = useActionState(async (previous: { error?: string; success?: string }, form: FormData) => {
    media.appendTo(form);
    try {
      const next = await updateCommunityAction(previous, form);
      if (!next.error) { setText(''); media.clear(); }
      return next;
    } catch { return { error: 'Не удалось отправить запись. Проверьте соединение и попробуйте снова.' }; }
  }, {});
  return <form action={action} className="wall-composer">
    <input type="hidden" name="operation" value="comment" /><input type="hidden" name="targetId" value={targetId} />
    <fieldset disabled={pending}>
      <label htmlFor="wall-text" className="sr-only">{label}</label>
      <div className="review-text-composer">
        <MentionTextarea id="wall-text" name="text" value={text} onValueChange={setText} onPaste={media.onPaste} placeholder={placeholder} maxLength={1000} rows={3} required />
        <div className="review-composer-toolbar">
          <MediaAttachButton media={media} label="Добавить фото, GIF или видео на стену" />
          <span>{media.preparing ? 'Готовим видео…' : `${media.files.length} / ${MAX_WALL_MEDIA} · фото, GIF, видео`}</span>
        </div>
      </div>
      {media.error && <p role="alert" className="field-error">{media.error}</p>}
      <MediaAttachmentPreviews media={media} />
      <div className="community-form-footer"><span className="community-muted">{text.length} / 1000</span><Submit disabled={!text.trim() || media.preparing}>Отправить</Submit></div>
    </fieldset>
    <p role={state.error ? 'alert' : 'status'} className={state.error ? 'field-error' : 'community-feedback'}>{state.error ?? state.success}</p>
  </form>;
}

export function DeleteWallComment({ id }: { id: string }) {
  return <CommunityForm className="wall-delete"><input type="hidden" name="operation" value="delete-comment" /><input type="hidden" name="commentId" value={id} /><DeleteWallButton /></CommunityForm>;
}

function DeleteWallButton() {
  const { pending } = useFormStatus();
  return <button className="wall-action-button wall-delete-button" type="submit" disabled={pending} aria-label="Удалить запись" title="Удалить запись" onClick={event => { if (!window.confirm('Удалить запись?')) event.preventDefault(); }}>
    <TrashIcon />
  </button>;
}

export function PresenceSetting({ visible }: { visible: boolean }) {
  return <CommunityForm className="profile-about-row presence-setting"><input type="hidden" name="operation" value="visibility" /><input type="hidden" name="visible" value={visible ? 'false' : 'true'} />
    <span className={`profile-about-icon presence-dot${visible ? ' is-on' : ''}`} aria-hidden="true"><i /></span>
    <span className="profile-about-text"><small>Статус в сети</small><strong>{visible ? 'Виден всем' : 'Скрыт'}</strong></span>
    <PresenceSwitch visible={visible} />
  </CommunityForm>;
}

/** Submit button styled as a switch: the form flips the stored visibility, so the switch shows the current state. */
function PresenceSwitch({ visible }: { visible: boolean }) {
  const { pending } = useFormStatus();
  return <button className="presence-switch" type="submit" role="switch" aria-checked={visible} aria-label={visible ? 'Скрыть статус в сети' : 'Показывать статус в сети'} disabled={pending} data-pending={pending || undefined}><span /></button>;
}
