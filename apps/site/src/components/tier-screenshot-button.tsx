'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { renderTierScreenshot } from '@/lib/tier-screenshot';

function Preview({ blob, url, copied, onClose }: { blob: Blob; url: string; copied: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [status, setStatus] = useState(copied ? 'Скриншот скопирован в буфер обмена' : 'Не удалось скопировать автоматически. Попробуйте ещё раз или скачайте PNG.');
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const focus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    dialog.current?.showModal(); document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; focus?.focus(); };
  }, []);
  return createPortal(<dialog ref={dialog} className="tier-screenshot-dialog" aria-labelledby="tier-screenshot-title" onCancel={onClose}>
    <div className="tier-screenshot-heading"><h2 id="tier-screenshot-title">Скриншот тирлиста</h2><button type="button" className="community-button community-button-secondary" onClick={onClose} aria-label="Закрыть скриншот">Закрыть ×</button></div>
    <p role="status">{status}</p>
    <div className="tier-screenshot-preview">
      {/* eslint-disable-next-line @next/next/no-img-element -- locally generated PNG */}
      <img src={url} alt="Текущий тирлист" />
    </div>
    <div className="tier-screenshot-actions">
      <button type="button" className="tier-primary-action" disabled={pending} onClick={async () => {
        setPending(true);
        try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); setStatus('Скриншот скопирован в буфер обмена'); }
        catch { setStatus('Браузер не разрешил копирование изображения. Скачайте PNG.'); }
        finally { setPending(false); }
      }}>{pending ? 'Копируем…' : 'Копировать'}</button>
      <a className="tier-secondary-action" href={url} download="canrush-tierlist.png">Скачать PNG</a>
    </div>
  </dialog>, document.body);
}

export function TierScreenshotButton({ boardId, title, titleInputId }: { boardId: string; title?: string; titleInputId?: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<{ blob: Blob; url: string; copied: boolean } | null>(null);
  const previewUrl = useRef<string | null>(null);
  useEffect(() => () => { if (previewUrl.current) URL.revokeObjectURL(previewUrl.current); }, []);
  async function capture() {
    const board = document.getElementById(boardId);
    if (!board) return;
    setPending(true); setError('');
    const input = titleInputId ? document.getElementById(titleInputId) : null;
    const result = renderTierScreenshot(board, input instanceof HTMLInputElement ? input.value : title ?? 'Тирлист CanRush');
    // Start clipboard.write during the user gesture, before image decoding completes (Safari).
    let copy: Promise<boolean> = Promise.resolve(false);
    try {
      if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') copy = navigator.clipboard.write([new ClipboardItem({ 'image/png': result })]).then(() => true, () => false);
    } catch { /* The preview still offers downloading if clipboard is unavailable. */ }
    try { const blob = await result; const copied = await copy; const url = URL.createObjectURL(blob); previewUrl.current = url; setPreview({ blob, url, copied }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось сделать скриншот. Попробуйте ещё раз.'); }
    finally { setPending(false); }
  }
  return <div className="tier-screenshot-control">
    <button type="button" className="tier-secondary-action" disabled={pending} onClick={capture}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M8 5 10 3h4l2 2h4v15H4V5z" strokeLinejoin="round"/><circle cx="12" cy="12" r="4"/></svg>{pending ? 'Создаём скриншот…' : 'Сделать скриншот'}</button>
    {error && <p className="field-error" role="alert">{error}</p>}
    {preview && <Preview {...preview} onClose={() => { URL.revokeObjectURL(preview.url); previewUrl.current = null; setPreview(null); }} />}
  </div>;
}
