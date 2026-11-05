'use client';

import { useState } from 'react';
import { ActionToast } from '@/components/action-toast';
import { nativeShare } from '@/lib/native-app';

const NO_NOTICE = {};

/** Shares a link (with optional text) through the system sheet on touch devices, the clipboard elsewhere; confirms in a toast. */
export function ShareTierListButton({ title, text, path, label = 'Поделиться' }: { title: string; text?: string; path?: string; label?: string }) {
  // The site's one toast (`ActionToast`): a new object shows it again, even with the same text.
  const [notice, setNotice] = useState<{ text: string; tone: 'success' | 'error' } | null>(null);
  const [pending, setPending] = useState(false);
  const notify = (text: string, error = false) => setNotice({ text, tone: error ? 'error' : 'success' });

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
      <ActionToast message={notice?.text} tone={notice?.tone} trigger={notice ?? NO_NOTICE} />
    </>
  );
}
