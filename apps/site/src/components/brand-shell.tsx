import { SettingsHeaderLink } from '@/components/settings-header-link';
import Image from 'next/image';
import Link from '@/components/navigation-progress';
import { Suspense, type ReactNode } from 'react';
import { CityHeader } from '@/components/city-header';
import { NotificationBell } from '@/components/notification-bell';
import { SiteFooter } from '@/components/site-footer';

interface BrandShellProps {
  children: ReactNode;
  headerAction?: ReactNode;
  surfaceClassName?: string;
}

export function BrandShell({ children, headerAction, surfaceClassName }: BrandShellProps) {
  return (
    <div className="site-shell">
      <header className="brand-header">
        <Link className="brand-home" href="/" aria-label="CanRush, на главную">
          <Image className="brand-mark" src="/brand/logo-mark.svg" width={36} height={30} alt="" priority />
          <Image
            className="brand-wordmark"
            src="/brand/logo-wordmark-white.svg"
            width={63}
            height={18}
            alt=""
            priority
          />
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
