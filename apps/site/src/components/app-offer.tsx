'use client';
import Image from 'next/image';
import { useEffect, useState, useSyncExternalStore } from 'react';

const HIDDEN_KEY = 'canrush-app-offer-hidden';
const DAYS_KEY = 'canrush-visit-days';
/** A closed offer comes back after this many days. */
const HIDE_DAYS = 30;
const today = () => new Date().toISOString().slice(0, 10);
const read = (key: string) => { try { return window.localStorage.getItem(key); } catch { return null; } };
const write = (key: string, value: string) => { try { window.localStorage.setItem(key, value); } catch { /* private window: shown again next time */ } };
const visitDays = (): string[] => { try { const days: unknown = JSON.parse(read(DAYS_KEY) ?? '[]'); return Array.isArray(days) ? days.filter((day): day is string => typeof day === 'string') : []; } catch { return []; } };

/**
 * Whether to offer the app: an Android browser (not the app itself, not Telegram), a second day of visits (a first
 * visit is about the site, not an install), and not closed in the last `HIDE_DAYS` days.
 */
function shouldOffer(): boolean {
  if (!/Android/i.test(navigator.userAgent) || /CanrushApp/i.test(navigator.userAgent)) return false;
  const root = document.documentElement;
  if (root.hasAttribute('data-native-app') || root.hasAttribute('data-telegram-app')) return false;
  const hidden = Number(read(HIDDEN_KEY));
  if (hidden && Date.now() - hidden < HIDE_DAYS * 86_400_000) return false;
  return visitDays().some(day => day !== today());
}
const subscribe = () => () => {};

/**
 * A quiet offer of the Android app on the home page, for Android browsers from the second day of visits: RuStore, and
 * the APK for phones without it when the site has one. Closing hides it for a month on this device. Nothing renders on
 * the server or on a first visit, so the page does not shift for most visitors.
 */
export function AppOffer({ rustoreUrl, apkUrl }: { rustoreUrl: string; apkUrl: string | null }) {
  const eligible = useSyncExternalStore(subscribe, shouldOffer, () => false);
  const [closed, setClosed] = useState(false);
  // This visit counts for the next one: the offer waits for a second day.
  useEffect(() => { const days = visitDays(); if (!days.includes(today())) write(DAYS_KEY, JSON.stringify([...days, today()].slice(-10))); }, []);
  if (!eligible || closed) return null;
  function close() { write(HIDDEN_KEY, String(Date.now())); setClosed(true); }
  return <aside className="app-offer" aria-labelledby="app-offer-title">
    <Image className="app-offer-icon" src="/icon.svg" width={48} height={48} alt="" unoptimized />
    <div className="app-offer-copy">
      <h2 id="app-offer-title">CanRush для Android</h2>
      <p>Открывается быстрее сайта, вход не слетает, уведомления о ценах и ответах приходят на телефон.</p>
      <div className="app-offer-actions">
        <a className="app-offer-button" href={rustoreUrl} target="_blank" rel="noopener noreferrer" onClick={close}>Скачать в RuStore</a>
        {apkUrl && <a className="app-offer-apk" href={apkUrl} download onClick={close}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>APK без RuStore
        </a>}
      </div>
    </div>
    <button type="button" className="app-offer-close" aria-label="Скрыть предложение приложения" onClick={close}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
    </button>
  </aside>;
}
