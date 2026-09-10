'use client';

import { useState } from 'react';

export function ShareTierListButton({ title }: { title: string }) {
  const [status, setStatus] = useState('');

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        setStatus('Ссылка отправлена');
      } else {
        await navigator.clipboard.writeText(url);
        setStatus('Ссылка скопирована');
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setStatus('Не удалось скопировать ссылку');
    }
  }

  return (
    <>
      <button className="tier-secondary-action" type="button" onClick={share}>
        Поделиться
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M12 16V3m0 0L7 8m5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 13v6h14v-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <span className="sr-only" aria-live="polite">
        {status}
      </span>
    </>
  );
}
