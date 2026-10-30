'use client';
import { useEffect } from 'react';
import { useErrorReport } from '@/lib/client-error-report';
import { parseSiteTheme, SITE_THEME_COOKIE } from '@/lib/site-theme';
import { objectSans } from './fonts';
import './globals.css';
import './site-theme.css';

/**
 * Replaces the root layout when nothing nearer caught the error, so it is its own document: no header actions, no
 * providers, only the logo and the way back. «Обновить» reloads the page: after a crash in the layout or a failed chunk
 * a re-render would stay on this screen. The theme comes from the cookie the layout read on the server.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useErrorReport(error);
  useEffect(() => {
    const cookie = document.cookie.split('; ').find(item => item.startsWith(`${SITE_THEME_COOKIE}=`))?.split('=')[1];
    document.documentElement.dataset.siteTheme = parseSiteTheme(cookie) ?? 'system';
  }, []);
  return <html data-site-theme="system" lang="ru" className={objectSans.variable}>
    <body>
      <title>Что-то пошло не так | CanRush</title>
      <div className="site-shell">
        <header className="brand-header">
          {/* A plain link: the router may be what broke. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a className="brand-home" href="/" aria-label="CanRush, на главную"><span className="brand-mark" aria-hidden="true" /><span className="brand-wordmark" aria-hidden="true" /></a>
        </header>
        <main className="main-surface" id="main-content">
          <section className="not-found-page" role="alert">
            <h1>Что-то пошло не так</h1>
            <p>Мы уже получили сообщение об этой ошибке. Обновите страницу: обычно этого достаточно.</p>
            <div className="not-found-actions">
              <button type="button" className="community-button" onClick={() => window.location.reload()}>Обновить</button>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a className="community-button community-button-secondary" href="/">На главную</a>
            </div>
          </section>
        </main>
      </div>
    </body>
  </html>;
}
