'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { isNativeApp, nativeImage } from '@/lib/native-app';
import { renderTierScreenshot, renderTierStory } from '@/lib/tier-screenshot';

export interface ScreenshotLabels { title: string; alt: string; file: string }
const TIER_LABELS: ScreenshotLabels = { title: 'Скриншот тирлиста', alt: 'Текущий тирлист', file: 'canrush-tierlist' };

/** Preview dialog with «Как есть» / 9:16 formats, copy and download; shared by tier lists and the drink calendar. */
export function ScreenshotPreview({ blob, url, renderStory, onClose, labels = TIER_LABELS }: { blob: Blob; url: string; renderStory: () => Promise<Blob>; onClose: () => void; labels?: ScreenshotLabels }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [notice, setNotice] = useState<{ message: string; error: boolean; id: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const sequence = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  function notify(message: string, error = false) {
    clearTimeout(timer.current);
    setNotice({ message, error, id: ++sequence.current });
    timer.current = setTimeout(() => setNotice(null), error ? 6000 : 4000);
  }
  const [pending, setPending] = useState(false);
  const [format, setFormat] = useState<'original' | 'story'>('original');
  const [story, setStory] = useState<{ blob: Blob; url: string } | null>(null);
  const [storyPending, setStoryPending] = useState(false);
  const storyUrl = useRef<string | null>(null);
  useEffect(() => () => { if (storyUrl.current) URL.revokeObjectURL(storyUrl.current); }, []);
  const current = format === 'story' && story ? story : { blob, url };
  const fileName = format === 'story' ? `${labels.file}-tiktok.png` : `${labels.file}.png`;
  // In the app the WebView cannot copy an image or download a blob link: save and share go through the shell.
  // The dialog opens only after a tap, on the client, so the shell can be checked right away.
  const [app] = useState(isNativeApp);
  const [image] = useState(nativeImage);
  async function run(action: () => Promise<void>, failure: string) {
    setPending(true);
    try { await action(); } catch { notify(failure, true); } finally { setPending(false); }
  }
  async function chooseStory() {
    setFormat('story');
    if (story || storyPending) return;
    setStoryPending(true);
    try { const frame = await renderStory(); const frameUrl = URL.createObjectURL(frame); storyUrl.current = frameUrl; setStory({ blob: frame, url: frameUrl }); }
    catch (cause) { setFormat('original'); notify(cause instanceof Error ? cause.message : 'Не удалось подготовить вертикальный формат.', true); }
    finally { setStoryPending(false); }
  }
  useEffect(() => {
    const focus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    dialog.current?.showModal(); document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; focus?.focus(); };
  }, []);
  return createPortal(<dialog ref={dialog} className="tier-screenshot-dialog" aria-labelledby="tier-screenshot-title" onCancel={onClose}>
    <div className="tier-screenshot-heading">
      <div><h2 id="tier-screenshot-title">{labels.title}</h2><p>{app ? 'Выберите формат и сохраните скриншот в галерею или поделитесь им.' : 'Выберите формат и нажмите «Копировать» или «Скачать PNG».'}</p></div>
      <button type="button" className="community-button community-button-secondary tier-screenshot-close" onClick={onClose} aria-label="Закрыть скриншот"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
    </div>
    <div className="tier-screenshot-formats" role="radiogroup" aria-label="Формат скриншота">
      <button type="button" role="radio" aria-checked={format === 'original'} onClick={() => setFormat('original')}>Как есть</button>
      <button type="button" role="radio" aria-checked={format === 'story'} onClick={chooseStory}>TikTok · 9:16</button>
    </div>
    <div className={`tier-screenshot-preview${format === 'story' ? ' is-story' : ''}`} aria-busy={format === 'story' && storyPending}>
      {format === 'story' && storyPending ? <p className="tier-screenshot-pending">Готовим вертикальный формат…</p>
        // eslint-disable-next-line @next/next/no-img-element -- locally generated PNG
        : <img src={current.url} alt={format === 'story' ? `${labels.alt} в вертикальном формате 9:16` : labels.alt} />}
    </div>
    <div className="tier-screenshot-actions">
      {app ? <>
        <button type="button" className="tier-primary-action" disabled={!image || pending || (format === 'story' && !story)} onClick={() => run(async () => {
          // iOS saves from the share sheet («Сохранить изображение»), so there is nothing to report afterwards.
          await image!.save(current.blob, fileName); if (!image!.viaSheet) notify('Сохранено в галерею, альбом CanRush');
        }, 'Не удалось сохранить. Попробуйте «Поделиться».')}>{pending ? 'Сохраняем…' : image?.viaSheet ? 'Сохранить в «Фото»' : 'Сохранить в галерею'}</button>
        <button type="button" className="tier-secondary-action" disabled={!image || pending || (format === 'story' && !story)} onClick={() => run(async () => {
          await image!.share(current.blob, fileName, labels.title);
        }, 'Не удалось открыть меню «Поделиться».')}>Поделиться</button>
        {!image && <p className="tier-screenshot-update" role="status">Обновите приложение CanRush, чтобы сохранять скриншоты.</p>}
      </> : <>
        <button type="button" className="tier-primary-action" disabled={pending || (format === 'story' && !story)} onClick={() => run(async () => {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': current.blob })]); notify(format === 'story' ? 'Вертикальный скриншот скопирован' : 'Скриншот скопирован в буфер обмена');
        }, 'Не удалось скопировать изображение. Скачайте PNG.')}>{pending ? 'Копируем…' : 'Копировать'}</button>
        {format === 'story' && !story ? <span className="tier-secondary-action" aria-disabled="true">Скачать PNG</span>
          : <a className="tier-secondary-action" href={current.url} download={fileName}>Скачать PNG</a>}
      </>}
    </div>
    {notice && <div className={`share-toast tier-screenshot-toast${notice.error ? ' share-toast-error' : ''}`}>
      <span key={notice.id} role={notice.error ? 'alert' : 'status'}>{notice.message}</span>
      <button type="button" aria-label="Закрыть уведомление" onClick={() => { clearTimeout(timer.current); setNotice(null); }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
    </div>}
  </dialog>, document.body);
}

export function TierScreenshotButton({ boardId, title, titleInputId, telegramChannel, authorUsername, official = false }: { boardId: string; title?: string; titleInputId?: string; telegramChannel?: string | null; authorUsername?: string; official?: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<{ blob: Blob; url: string; renderStory: () => Promise<Blob> } | null>(null);
  const previewUrl = useRef<string | null>(null);
  useEffect(() => () => { if (previewUrl.current) URL.revokeObjectURL(previewUrl.current); }, []);
  async function capture() {
    const board = document.getElementById(boardId);
    if (!board) return;
    setPending(true); setError('');
    const input = titleInputId ? document.getElementById(titleInputId) : null;
    const caption = input instanceof HTMLInputElement ? input.value : title ?? 'Тирлист CanRush';
    const result = renderTierScreenshot(board, caption, telegramChannel, authorUsername, official);
    // The vertical version is drawn from the same board state on demand (when 9:16 is picked).
    const renderStory = () => renderTierStory(board, caption, telegramChannel, authorUsername, official);
    try { const blob = await result; const url = URL.createObjectURL(blob); previewUrl.current = url; setPreview({ blob, url, renderStory }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось сделать скриншот. Попробуйте ещё раз.'); }
    finally { setPending(false); }
  }
  return <div className="tier-screenshot-control">
    <button type="button" className="tier-secondary-action" disabled={pending} onClick={capture}>{pending ? 'Создаём…' : 'Скриншот'}<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M8 6 9.4 4.6A2 2 0 0 1 10.8 4h2.4a2 2 0 0 1 1.4.6L16 6h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" strokeLinejoin="round"/><circle cx="12" cy="12" r="4"/></svg></button>
    {error && <p className="field-error" role="alert">{error}</p>}
    {preview && <ScreenshotPreview {...preview} onClose={() => { URL.revokeObjectURL(preview.url); previewUrl.current = null; setPreview(null); }} />}
  </div>;
}
