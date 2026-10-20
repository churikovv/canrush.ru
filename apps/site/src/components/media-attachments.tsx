'use client';
import { useEffect, useRef, useState, type ClipboardEvent } from 'react';
import { PhotoDeleteIcon } from '@/components/photo-delete-icon';
import { pastedFiles } from '@/lib/clipboard-files';
import { MAX_REVIEW_PHOTO_BYTES } from '@/lib/review-photo-limits';
import { MAX_WALL_GIF_BYTES, MAX_WALL_MEDIA, MAX_WALL_UPLOAD_BYTES, MAX_WALL_VIDEO_BYTES, WALL_GIF_TYPES, WALL_IMAGE_TYPES, WALL_MEDIA_ACCEPT, WALL_VIDEO_TYPES, type WallMediaKind } from '@/lib/wall-media-limits';

export type MediaAttachment = { file: File; url: string; kind: WallMediaKind; poster?: Blob };

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

export function attachmentKind(file: File): WallMediaKind | null {
  if (WALL_VIDEO_TYPES.includes(file.type)) return 'video';
  if (WALL_GIF_TYPES.includes(file.type)) return 'gif';
  return WALL_IMAGE_TYPES.includes(file.type) ? 'image' : null;
}

const ATTACHMENT_NAME: Record<WallMediaKind, string> = { image: 'фотография', gif: 'GIF', video: 'видео' };

/**
 * Photos, GIFs and one video for a wall record or a comment, by the server's rules (prepareWallMedia): checked
 * in the browser first, videos get a poster frame. Files come from the picker or are pasted from the clipboard.
 */
export function useMediaAttachments(place = 'записи') {
  const [files, setFiles] = useState<MediaAttachment[]>([]);
  const [error, setError] = useState('');
  const [preparing, setPreparing] = useState(false);
  const previews = useRef(new Set<string>());
  useEffect(() => { const urls = previews.current; return () => urls.forEach(url => URL.revokeObjectURL(url)); }, []);
  function release(url: string) { URL.revokeObjectURL(url); previews.current.delete(url); }

  async function add(added: File[]) {
    if (!added.length) return;
    if (added.length + files.length > MAX_WALL_MEDIA) { setError(`Можно добавить не более ${MAX_WALL_MEDIA} вложений.`); return; }
    const kinds = added.map(attachmentKind);
    if (kinds.some(kind => !kind)) { setError('Поддерживаются JPG, PNG, WebP, GIF, MP4 и WebM.'); return; }
    if (added.some((file, index) => file.size > (kinds[index] === 'video' ? MAX_WALL_VIDEO_BYTES : kinds[index] === 'gif' ? MAX_WALL_GIF_BYTES : MAX_REVIEW_PHOTO_BYTES))) { setError('Фото — до 5 МБ, GIF — до 8 МБ, видео — до 20 МБ.'); return; }
    if (kinds.filter(kind => kind === 'video').length + files.filter(item => item.kind === 'video').length > 1) { setError(`К ${place} можно прикрепить одно видео.`); return; }
    if ([...files.map(item => item.file), ...added].reduce((sum, file) => sum + file.size, 0) > MAX_WALL_UPLOAD_BYTES) { setError('Вложения вместе должны быть не больше 24 МБ.'); return; }
    setError(''); setPreparing(true);
    const next: MediaAttachment[] = [];
    try {
      for (const [index, file] of added.entries()) {
        const url = URL.createObjectURL(file); previews.current.add(url);
        const kind = kinds[index]!;
        if (kind === 'video') {
          try { next.push({ file, url, kind, poster: await capturePoster(url) }); }
          catch { release(url); setError('Это видео не открывается в браузере. Сохраните его как MP4 (H.264) или WebM.'); continue; }
        } else next.push({ file, url, kind });
      }
    } finally { setPreparing(false); }
    setFiles(current => [...current, ...next]);
  }

  return {
    files, error, preparing, setError,
    add,
    remove(url: string) { release(url); setFiles(current => current.filter(item => item.url !== url)); },
    clear() { previews.current.forEach(url => URL.revokeObjectURL(url)); previews.current.clear(); setFiles([]); setError(''); },
    /** Adds the files as `photos` and the video poster as `videoPoster`, the fields prepareWallMedia reads. */
    appendTo(form: FormData) {
      files.forEach(({ file }) => form.append('photos', file));
      const poster = files.find(item => item.poster)?.poster;
      if (poster) form.append('videoPoster', poster, 'poster.webp');
    },
    /** onPaste for the text field: pasted images and videos become attachments, plain text pastes as usual. */
    onPaste(event: ClipboardEvent) {
      const pasted = pastedFiles(event, file => attachmentKind(file) !== null);
      if (pasted.length) void add(pasted);
    },
  };
}
export type MediaAttachments = ReturnType<typeof useMediaAttachments>;

export function MediaAttachButton({ media, label }: { media: MediaAttachments; label: string }) {
  return <span className="review-photo-picker review-photo-icon" title="Добавить фото, GIF или видео (можно вставить из буфера обмена)">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 3-3 6 6"/></svg>
    <input type="file" accept={WALL_MEDIA_ACCEPT} multiple aria-label={label} disabled={media.files.length >= MAX_WALL_MEDIA || media.preparing}
      onChange={event => { void media.add(Array.from(event.currentTarget.files ?? [])); event.currentTarget.value = ''; }} />
  </span>;
}

export function MediaAttachmentPreviews({ media }: { media: MediaAttachments }) {
  if (!media.files.length) return null;
  return <div className="review-photo-previews">{media.files.map(({ file, url, kind }, index) => <div key={url} className="review-photo-preview" data-kind={kind}>
    {kind === 'video'
      ? <video src={url} muted playsInline preload="metadata" aria-label={`Новое видео ${index + 1}: ${file.name}`} />
      /* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */
      : <img src={url} alt={`Новое вложение ${index + 1}: ${file.name}`} />}
    {kind !== 'image' && <span className="review-media-badge" aria-hidden="true">{kind === 'gif' ? 'GIF' : 'Видео'}</span>}
    <button className="photo-delete-overlay" title="Удалить вложение" type="button" aria-label={`Удалить ${ATTACHMENT_NAME[kind]} ${index + 1}`} onClick={() => media.remove(url)}><PhotoDeleteIcon /></button>
  </div>)}</div>;
}
