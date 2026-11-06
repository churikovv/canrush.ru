'use client';

import { useState, useSyncExternalStore } from 'react';
import { BADGE_HEIGHT, BADGE_WIDTH, type BadgeTheme } from '@/lib/brand-materials-fields';
import { isNativeApp } from '@/lib/native-app';

const subscribeNever = () => () => {};
/** The apps' web view prints and downloads nothing: there the page says to do it from a computer. */
function useNativeApp() {
  return useSyncExternalStore(subscribeNever, isNativeApp, () => false);
}

/** «Распечатать» on the poster page; in the app — where to print instead. */
export function PrintButton() {
  const native = useNativeApp();
  if (native) return <p className="poster-native-note">Распечатать можно с компьютера: откройте кабинет на canrush.ru — плакат будет там же.</p>;
  return <button type="button" className="bc-button" onClick={() => window.print()}>Распечатать</button>;
}

/** «Скачать QR (SVG)» for a designer; the apps can't save files from a page, so there it is gone. */
export function QrDownload({ href, fileName }: { href: string; fileName: string }) {
  const native = useNativeApp();
  if (native) return null;
  return <a className="bc-button is-outline" href={href} download={fileName}>Скачать QR (SVG)</a>;
}

export interface BadgeVariant { src: string; code: string }

/**
 * The badge's preview and the HTML to paste, light or dark: the brand picks the one that suits its site, copies the
 * code in one tap and sees the picture it will get.
 */
export function BadgeCode({ name, variants }: { name: string; variants: Record<BadgeTheme, BadgeVariant> }) {
  const [theme, setTheme] = useState<BadgeTheme>('light');
  const [copied, setCopied] = useState(false);
  const variant = variants[theme];
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(variant.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch { setCopied(false); }
  };
  return <div className="bm-badge">
    <div className="bc-segments bm-badge-themes" role="radiogroup" aria-label="Фон сайта">
      {(['light', 'dark'] as const).map(item => <button key={item} type="button" role="radio" aria-checked={theme === item}
        onClick={() => { setTheme(item); setCopied(false); }}>{item === 'light' ? 'Светлый сайт' : 'Тёмный сайт'}</button>)}
    </div>
    <div className="bm-badge-preview" data-theme={theme}>
      {/* eslint-disable-next-line @next/next/no-img-element -- the badge is the very picture other sites load */}
      <img src={variant.src} width={BADGE_WIDTH} height={BADGE_HEIGHT} alt={`Значок оценки «${name}»`} />
    </div>
    <label className="bm-code">
      <span>Код для сайта</span>
      <textarea readOnly rows={4} value={variant.code} onFocus={event => event.currentTarget.select()} />
    </label>
    <button type="button" className="bc-button" onClick={copy}>{copied ? 'Скопировано' : 'Скопировать код'}</button>
    <p className="bc-muted bm-note" role="status">{copied ? 'Вставьте код на страницу сайта — значок сам обновляет оценку раз в час.' : 'Значок ведёт на страницу на CanRush и сам обновляет оценку раз в час.'}</p>
  </div>;
}
