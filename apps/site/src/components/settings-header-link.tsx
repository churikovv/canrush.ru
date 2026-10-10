'use client';
import Link from '@/components/navigation-progress';
import { usePathname } from 'next/navigation';
export function SettingsHeaderLink() {
  const active = usePathname() === '/profile/settings';
  return <Link href="/profile/settings" className="settings-header-link" aria-label="Настройки" title="Настройки" aria-current={active ? 'page' : undefined}>
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9.5 3-.5 2a7 7 0 0 0-1.8 1L5.2 5.5 3 9.3l1.5 1.4a7 7 0 0 0 0 2.6L3 14.7l2.2 3.8 2-.5A7 7 0 0 0 9 19l.5 2h5l.5-2a7 7 0 0 0 1.8-1l2 .5 2.2-3.8-1.5-1.4a7 7 0 0 0 0-2.6L21 9.3l-2.2-3.8-2 .5A7 7 0 0 0 15 5l-.5-2z" /><circle cx="12" cy="12" r="3" /></svg>
  </Link>;
}
