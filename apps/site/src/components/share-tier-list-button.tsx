'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { nativeShare } from '@/lib/native-app';

/** Shares a link (with optional text) through the system sheet on touch devices, the clipboard elsewhere; confirms in a toast. */
export function ShareTierListButton({ title, text, path, label = 'Поделиться' }: { title: string; text?: string; path?: string; label?: string }) {
  const [notice, setNotice] = useState<{ message: string; error: boolean; id: number } | null>(null);
  const [pending, setPending] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const sequence = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);

  function notify(message: string, error = false) {
    clearTimeout(timer.current);
    setNotice({ message, error, id: ++sequence.current });
    timer.current = setTimeout(() => setNotice(null), error ? 6000 : 4000);
  }

  async function share() {
    const url = path ? new URL(path, window.location.origin).toString() : window.location.href;
    setPending(true);
    try {
      const native = await nativeShare({ title, text, url, dialogTitle: title });
      if (native === 'cancelled') return;
      if (native === 'shared') {
        notify('Ссылка отправлена');
        return;
      }
      // On desktop, make the action predictable: copy and confirm visibly.
      if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
        try {
          await navigator.share({ title, text, url });
          notify('Ссылка отправлена');
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') return;
          // If the system share sheet fails, try copying instead.
        }
      }
      await navigator.clipboard.writeText(text ? `${text}\n${url}` : url);
      notify(text ? 'Итог и ссылка скопированы' : 'Ссылка скопирована');
    } catch {
      notify('Не удалось скопировать ссылку. Скопируйте её из адресной строки.', true);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button className="tier-secondary-action" type="button" onClick={share} disabled={pending}>
        {label}
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M12 16V3m0 0L7 8m5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 13v6h14v-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {notice && createPortal(
        <div className={`share-toast${notice.error ? ' share-toast-error' : ''}`}>
          <span key={notice.id} role={notice.error ? 'alert' : 'status'}>{notice.message}</span>
          <button type="button" aria-label="Закрыть уведомление" onClick={() => { clearTimeout(timer.current); setNotice(null); }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" /></svg>
          </button>
        </div>, document.body,
      )}
    </>
  );
}
