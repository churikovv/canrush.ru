'use client';
import { useEffect, useRef, useState } from 'react';

/** Shares the month summary: the system sheet on touch devices, the clipboard elsewhere. */
export function DrinkShareButton({ title, text, path }: { title: string; text: string; path: string }) {
  const [notice, setNotice] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  function notify(message: string) { clearTimeout(timer.current); setNotice(message); timer.current = setTimeout(() => setNotice(''), 4000); }
  async function share() {
    const url = new URL(path, window.location.origin).toString();
    if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
      try { await navigator.share({ title, text, url }); return; }
      catch (error) { if (error instanceof DOMException && error.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(`${text}\n${url}`); notify('Итог скопирован — вставьте его в чат или сторис'); }
    catch { notify('Не удалось скопировать. Скопируйте ссылку из адресной строки.'); }
  }
  return <div className="drink-share">
    <button type="button" className="community-button" onClick={share}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V3m0 0L7 8m5-5 5 5M5 13v6h14v-6" /></svg>
      Поделиться итогом
    </button>
    <span role="status" aria-live="polite">{notice}</span>
  </div>;
}
