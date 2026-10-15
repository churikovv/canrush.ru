'use client';
import { PhotoDeleteIcon } from '@/components/photo-delete-icon';

import { useActionState, useEffect, useRef, useState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { updateCommunityAction } from '@/app/profile/community-actions';
import { MAX_REVIEW_PHOTO_BYTES, REVIEW_PHOTO_TYPES } from '@/lib/review-photo-limits';
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
  const [files, setFiles] = useState<{ file: File; url: string }[]>([]);
  const [photoError, setPhotoError] = useState('');
  const previews = useRef(new Set<string>());
  useEffect(() => { const urls = previews.current; return () => urls.forEach(url => URL.revokeObjectURL(url)); }, []);
  const [state, action, pending] = useActionState(async (previous: { error?: string; success?: string }, form: FormData) => {
    files.forEach(({ file }) => form.append('photos', file));
    try {
      const next = await updateCommunityAction(previous, form);
      if (!next.error) {
        setText(''); setFiles([]); setPhotoError('');
        previews.current.forEach(url => URL.revokeObjectURL(url)); previews.current.clear();
      }
      return next;
    } catch { return { error: 'Не удалось отправить запись. Проверьте соединение и попробуйте снова.' }; }
  }, {});
  function choosePhotos(selected: FileList | null) {
    const added = Array.from(selected ?? []);
    if (added.length + files.length > 5) { setPhotoError('Можно добавить не более 5 фотографий.'); return; }
    if (added.some(file => file.size > MAX_REVIEW_PHOTO_BYTES || !REVIEW_PHOTO_TYPES.includes(file.type))) { setPhotoError('Выберите JPG, PNG или WebP не больше 5 МБ каждый.'); return; }
    setPhotoError('');
    setFiles(current => [...current, ...added.map(file => { const url = URL.createObjectURL(file); previews.current.add(url); return { file, url }; })]);
  }
  return <form action={action} className="wall-composer">
    <input type="hidden" name="operation" value="comment" /><input type="hidden" name="targetId" value={targetId} />
    <fieldset disabled={pending}>
      <label htmlFor="wall-text" className="sr-only">{label}</label>
      <div className="review-text-composer">
        <textarea id="wall-text" name="text" value={text} onChange={event => setText(event.target.value)} placeholder={placeholder} maxLength={1000} rows={3} required />
        <div className="review-composer-toolbar">
          <span className="review-photo-picker review-photo-icon" title="Добавить фотографии">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 3-3 6 6"/></svg>
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple aria-label="Добавить фотографии на стену" disabled={files.length >= 5} onChange={event => { choosePhotos(event.currentTarget.files); event.currentTarget.value = ''; }} />
          </span><span>{files.length} / 5 фото</span>
        </div>
      </div>
      {photoError && <p role="alert" className="field-error">{photoError}</p>}
      <div className="review-photo-previews">{files.map(({ file, url }, index) => <div key={url} className="review-photo-preview">
        {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
        <img src={url} alt={`Новая фотография ${index + 1}: ${file.name}`} />
        <button className="photo-delete-overlay" title="Удалить фотографию" type="button" aria-label={`Удалить новую фотографию ${index + 1}`} onClick={() => { URL.revokeObjectURL(url); previews.current.delete(url); setFiles(current => current.filter(item => item.url !== url)); }}><PhotoDeleteIcon /></button>
      </div>)}</div>
      <div className="community-form-footer"><span className="community-muted">{text.length} / 1000</span><Submit disabled={!text.trim()}>Отправить</Submit></div>
    </fieldset>
    <p role={state.error ? 'alert' : 'status'} className={state.error ? 'field-error' : 'community-feedback'}>{state.error ?? state.success}</p>
  </form>;
}

export function DeleteWallComment({ id }: { id: string }) {
  return <CommunityForm className="wall-delete"><input type="hidden" name="operation" value="delete-comment" /><input type="hidden" name="commentId" value={id} /><DeleteWallButton /></CommunityForm>;
}

function DeleteWallButton() {
  const { pending } = useFormStatus();
  return <button className="wall-delete-button" type="submit" disabled={pending} aria-label="Удалить запись" title="Удалить запись" onClick={event => { if (!window.confirm('Удалить запись?')) event.preventDefault(); }}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>
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
