'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { DECOR_MOTION_COOKIE } from '@/lib/decor-motion';

const YEAR = 60 * 60 * 24 * 365;
const SPARKLE = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
  <path d="M12 3v3M12 18v3M3 12h3M18 12h3M12 8l1.2 2.8L16 12l-2.8 1.2L12 16l-1.2-2.8L8 12l2.8-1.2Z" />
</svg>;

/**
 * «Анимация тегов и рамок» in the settings: a switch that takes effect at once — the cookie for the next pages, the
 * attribute on `<html>` for this one — and refreshes the page so the settings list reads the new value.
 */
export function DecorMotionSettings({ on }: { on: boolean }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(on);
  function change(next: boolean) {
    setEnabled(next);
    document.cookie = `${DECOR_MOTION_COOKIE}=${next ? 'on' : 'off'}; path=/; max-age=${YEAR}; samesite=lax`;
    if (next) document.documentElement.dataset.decorMotion = 'on';
    else delete document.documentElement.dataset.decorMotion;
    router.refresh();
  }
  return <section className="community-panel" aria-labelledby="decor-motion-title">
    <h2 id="decor-motion-title">Анимация тегов и рамок</h2>
    <p className="community-section-note">Переливы тегов, движение рамок аватарок и блеск значка уровня. Без них ленты листаются легче на слабых телефонах. Выбор сохраняется в этом браузере.</p>
    <div className="settings-list">
      <label className="settings-row">
        <span className="settings-row-icon" aria-hidden="true">{SPARKLE}</span>
        <span className="settings-row-text"><strong>Анимировать теги и рамки</strong><small>{enabled ? 'Включено' : 'Выключено'}</small></span>
        <input className="settings-switch" type="checkbox" role="switch" checked={enabled} onChange={event => change(event.target.checked)} />
      </label>
    </div>
  </section>;
}
