import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

interface BrandShellProps {
  children: ReactNode;
  headerAction?: ReactNode;
}

export function BrandShell({ children, headerAction }: BrandShellProps) {
  return (
    <div className="site-shell">
      <header className="brand-header">
        <Link className="brand-home" href="/" aria-label="CanRush, на главную">
          <Image src="/brand/logo-mark.svg" width={36} height={30} alt="" priority />
        </Link>
        {headerAction ? <div className="header-action">{headerAction}</div> : null}
      </header>
      <main className="main-surface" id="main-content">
        {children}
      </main>
      <footer className="brand-footer">
        <div className="footer-brand" aria-label="CanRush">
          <span className="footer-mark">
            <Image src="/brand/logo-mark-white.svg" width={17} height={13} alt="" />
          </span>
          <Image src="/brand/logo-wordmark-white.svg" width={63} height={18} alt="" />
        </div>
        <p>Сервис по поиску энергетических напитков</p>
        <div className="footer-group">
          <span>Связаться</span>
          <a href="mailto:hello@canrush.ru">hello@canrush.ru</a>
        </div>
        <p className="footer-legal">
          Canrush.ru © 2026. Сайт не аффилирован и не одобрен производителями или ретейлерами.
          Информация представлена в ознакомительных целях.
        </p>
      </footer>
    </div>
  );
}
