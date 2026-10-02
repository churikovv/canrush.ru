import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
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
        <Link className="brand-home" href="/catalog" aria-label="CanRush, на главную">
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
        {headerAction ? <div className="header-action">{headerAction}</div> : null}
      </header>
      <main className={surfaceClassName ? `main-surface ${surfaceClassName}` : 'main-surface'} id="main-content">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
