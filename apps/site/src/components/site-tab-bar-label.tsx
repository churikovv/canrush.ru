'use client';

import { useLinkStatus } from 'next/link';

export function SiteTabBarLabel({ children }: { children: string }) {
  const { pending } = useLinkStatus();

  return (
    <span className="site-tab-bar-label" data-pending={pending ? 'true' : undefined}>
      {children}
    </span>
  );
}
