'use client';
import { PhotoDeleteIcon } from '@/components/photo-delete-icon';
import { TrashIcon } from '@/components/action-icons';

import { useActionState, useEffect, useRef, useState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { updateCommunityAction } from '@/app/profile/community-actions';
import { MAX_REVIEW_PHOTO_BYTES } from '@/lib/review-photo-limits';
import { MAX_WALL_GIF_BYTES, MAX_WALL_MEDIA, MAX_WALL_UPLOAD_BYTES, MAX_WALL_VIDEO_BYTES, WALL_GIF_TYPES, WALL_IMAGE_TYPES, WALL_MEDIA_ACCEPT, WALL_VIDEO_TYPES, type WallMediaKind } from '@/lib/wall-media-limits';
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

type WallAttachment = { file: File; url: string; kind: WallMediaKind; poster?: Blob };

/** First frame of a local video as an image; fails for codecs this browser cannot decode. */
function capturePoster(url: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const timer = window.setTimeout(() => fail(), 10_000);
    const done = () => { window.clearTimeout(timer); video.removeAttribute('src'); video.load(); };
    function fail() { done(); reject(new Error('Video is not readable')); }
    video.muted = true; video.playsInline = true; video.preload = 'auto';
    video.onerror = fail;
    video.onloadeddata = () => { video.currentTime = Math.min(0.1, (video.duration || 0) / 2); };
    video.onseeked = () => {
      const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
      if (!video.videoWidth || !video.videoHeight) { fail(); return; }
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(video.videoHeight * scale);
      canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => { done(); if (blob) resolve(blob); else reject(new Error('No poster')); }, 'image/webp', 0.82);
    };
    video.src = url;
  });
}

function attachmentKind(file: File): WallMediaKind | null {
  if (WALL_VIDEO_TYPES.includes(file.type)) return 'video';
  if (WALL_GIF_TYPES.includes(file.type)) return 'gif';
  return WALL_IMAGE_TYPES.includes(file.type) ? 'image' : null;
}

const ATTACHMENT_NAME: Record<WallMediaKind, string> = { image: 'фотография', gif: 'GIF', video: 'видео' };

export function WallComposer({ targetId, label = 'Комментарий на стене', placeholder = 'Напишите на стене…' }: { targetId: string; label?: string; placeholder?: string }) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<WallAttachment[]>([]);
  const [photoError, setPhotoError] = useState('');
  const [preparing, setPreparing] = useState(false);
  const previews = useRef(new Set<string>());
  useEffect(() => { const urls = previews.current; return () => urls.forEach(url => URL.revokeObjectURL(url)); }, []);
  const [state, action, pending] = useActionState(async (previous: { error?: string; success?: string }, form: FormData) => {
    files.forEach(({ file }) => form.append('photos', file));
    const poster = files.find(item => item.poster)?.poster;
    if (poster) form.append('videoPoster', poster, 'poster.webp');
    try {
      const next = await updateCommunityAction(previous, form);
      if (!next.error) {
        setText(''); setFiles([]); setPhotoError('');
        previews.current.forEach(url => URL.revokeObjectURL(url)); previews.current.clear();
      }
      return next;
    } catch { return { error: 'Не удалось отправить запись. Проверьте соединение и попробуйте снова.' }; }
  }, {});
  function release(url: string) { URL.revokeObjectURL(url); previews.current.delete(url); }
  async function choosePhotos(selected: FileList | null) {
    const added = Array.from(selected ?? []);
    if (added.length + files.length > MAX_WALL_MEDIA) { setPhotoError('Можно добавить не более 5 вложений.'); return; }
    const kinds = added.map(attachmentKind);
    if (kinds.some(kind => !kind)) { setPhotoError('Поддерживаются JPG, PNG, WebP, GIF, MP4 и WebM.'); return; }
    if (added.some((file, index) => file.size > (kinds[index] === 'video' ? MAX_WALL_VIDEO_BYTES : kinds[index] === 'gif' ? MAX_WALL_GIF_BYTES : MAX_REVIEW_PHOTO_BYTES))) { setPhotoError('Фото — до 5 МБ, GIF — до 8 МБ, видео — до 20 МБ.'); return; }
    if (kinds.filter(kind => kind === 'video').length + files.filter(item => item.kind === 'video').length > 1) { setPhotoError('К записи можно прикрепить одно видео.'); return; }
    if ([...files.map(item => item.file), ...added].reduce((sum, file) => sum + file.size, 0) > MAX_WALL_UPLOAD_BYTES) { setPhotoError('Вложения вместе должны быть не больше 24 МБ.'); return; }
    setPhotoError(''); setPreparing(true);
    const next: WallAttachment[] = [];
    try {
      for (const [index, file] of added.entries()) {
        const url = URL.createObjectURL(file); previews.current.add(url);
        const kind = kinds[index]!;
        if (kind === 'video') {
          try { next.push({ file, url, kind, poster: await capturePoster(url) }); }
          catch { release(url); setPhotoError('Это видео не открывается в браузере. Сохраните его как MP4 (H.264) или WebM.'); continue; }
        } else next.push({ file, url, kind });
      }
    } finally { setPreparing(false); }
    setFiles(current => [...current, ...next]);
  }
  return <form action={action} className="wall-composer">
    <input type="hidden" name="operation" value="comment" /><input type="hidden" name="targetId" value={targetId} />
    <fieldset disabled={pending}>
      <label htmlFor="wall-text" className="sr-only">{label}</label>
      <div className="review-text-composer">
        <textarea id="wall-text" name="text" value={text} onChange={event => setText(event.target.value)} placeholder={placeholder} maxLength={1000} rows={3} required />
        <div className="review-composer-toolbar">
          <span className="review-photo-picker review-photo-icon" title="Добавить фото, GIF или видео">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 3-3 6 6"/></svg>
            <input type="file" accept={WALL_MEDIA_ACCEPT} multiple aria-label="Добавить фото, GIF или видео на стену" disabled={files.length >= MAX_WALL_MEDIA || preparing} onChange={event => { void choosePhotos(event.currentTarget.files); event.currentTarget.value = ''; }} />
          </span><span>{preparing ? 'Готовим видео…' : `${files.length} / ${MAX_WALL_MEDIA} · фото, GIF, видео`}</span>
        </div>
      </div>
      {photoError && <p role="alert" className="field-error">{photoError}</p>}
      <div className="review-photo-previews">{files.map(({ file, url, kind }, index) => <div key={url} className="review-photo-preview" data-kind={kind}>
        {kind === 'video'
          ? <video src={url} muted playsInline preload="metadata" aria-label={`Новое видео ${index + 1}: ${file.name}`} />
          /* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */
          : <img src={url} alt={`Новое вложение ${index + 1}: ${file.name}`} />}
        {kind !== 'image' && <span className="review-media-badge" aria-hidden="true">{kind === 'gif' ? 'GIF' : 'Видео'}</span>}
        <button className="photo-delete-overlay" title="Удалить вложение" type="button" aria-label={`Удалить ${ATTACHMENT_NAME[kind]} ${index + 1}`} onClick={() => { release(url); setFiles(current => current.filter(item => item.url !== url)); }}><PhotoDeleteIcon /></button>
      </div>)}</div>
      <div className="community-form-footer"><span className="community-muted">{text.length} / 1000</span><Submit disabled={!text.trim() || preparing}>Отправить</Submit></div>
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
