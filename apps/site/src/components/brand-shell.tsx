import { SettingsHeaderLink } from '@/components/settings-header-link';
import Link from '@/components/navigation-progress';
import { Suspense, type ReactNode } from 'react';
import { CityHeader } from '@/components/city-header';
import { NotificationBell } from '@/components/notification-bell';
import { SiteFooter } from '@/components/site-footer';
import { TapMotion } from '@/components/tap-motion';

interface BrandShellProps {
  children: ReactNode;
  headerAction?: ReactNode;
  surfaceClassName?: string;
}

export function BrandShell({ children, headerAction, surfaceClassName }: BrandShellProps) {
  return (
    <div className="site-shell">
      <header className="brand-header" data-motion-scope="header">
        <TapMotion />
        <Link className="brand-home" href="/" aria-label="CanRush, на главную">
          {/* The original logo files, recoloured with a CSS mask: the mark in brand blue, the wordmark in the theme's ink. */}
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-wordmark" aria-hidden="true" />
        </Link>
        <Suspense fallback={<span className="city-header-placeholder">Город</span>}><CityHeader /></Suspense>
        <div className="header-action">{headerAction}<NotificationBell /><SettingsHeaderLink /></div>
      </header>
      <main className={surfaceClassName ? `main-surface ${surfaceClassName}` : 'main-surface'} id="main-content">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
