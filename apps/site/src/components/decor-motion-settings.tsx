'use client';
import { useRouter } from 'next/navigation';
import { useState, useSyncExternalStore } from 'react';
import { DECOR_MOTION_COOKIE, STILL_DEVICE_QUERY, type DecorMotionChoice } from '@/lib/decor-motion';

const YEAR = 60 * 60 * 24 * 365;
const SPARKLE = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
  <path d="M12 3v3M12 18v3M3 12h3M18 12h3M12 8l1.2 2.8L16 12l-2.8 1.2L12 16l-1.2-2.8L8 12l2.8-1.2Z" />
</svg>;

/** Whether this device moves by default: not a touch screen. The server does not know the device and says «still». */
function useMovingDevice(): boolean {
  return useSyncExternalStore(change => {
    const query = window.matchMedia(STILL_DEVICE_QUERY);
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, () => !window.matchMedia(STILL_DEVICE_QUERY).matches, () => false);
}

/**
 * «Анимация тегов и рамок» in the settings. The switch shows what this device does now: by default it follows the
 * device (moving on a computer, still on a phone); pressing it fixes the member's choice in the cookie for good, and
 * «Как на устройстве» goes back to the default. Every change applies at once — the attribute on `<html>` for this page —
 * and refreshes the page so the settings list reads the new value.
 */
export function DecorMotionSettings({ choice: initial }: { choice: DecorMotionChoice }) {
  const router = useRouter();
  const [choice, setChoice] = useState<DecorMotionChoice>(initial);
  const moving = useMovingDevice();
  const enabled = choice ? choice === 'on' : moving;

  function save(next: DecorMotionChoice) {
    setChoice(next);
    document.cookie = next ? `${DECOR_MOTION_COOKIE}=${next}; path=/; max-age=${YEAR}; samesite=lax` : `${DECOR_MOTION_COOKIE}=; path=/; max-age=0; samesite=lax`;
    if (next) document.documentElement.dataset.decorMotion = next;
    else delete document.documentElement.dataset.decorMotion;
    router.refresh();
  }

  const state = choice === 'on' ? 'Включено вами' : choice === 'off' ? 'Выключено вами'
    : `Автоматически: ${moving ? 'на компьютере включено' : 'на телефоне выключено'}`;
  // The same markup as the other settings panels (`Panel` in the settings page): heading and note, then the list 20px below.
  return <section className="community-panel profile-editor-group profile-settings" aria-labelledby="decor-motion-title">
    <div className="profile-editor-group-heading">
      <h2 id="decor-motion-title">Анимация тегов и рамок</h2>
      <p>Переливы тегов, движение рамок аватарок и блеск значка уровня. Сами по себе они включены на компьютере и выключены на телефоне: там ленты без них листаются легче. Выбор сохраняется в этом браузере.</p>
    </div>
    <div className="settings-list">
      <label className="settings-row">
        <span className="settings-row-icon" aria-hidden="true">{SPARKLE}</span>
        <span className="settings-row-text"><strong>Анимировать теги и рамки</strong><small>{state}</small></span>
        <input className="settings-switch" type="checkbox" role="switch" checked={enabled} onChange={event => save(event.target.checked ? 'on' : 'off')} />
      </label>
    </div>
    {choice && <button type="button" className="decor-motion-auto" onClick={() => save(null)}>Как на устройстве</button>}
  </section>;
}
