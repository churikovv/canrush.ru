'use client';
import { useCallback, useState } from 'react';
import Link from '@/components/navigation-progress';
import { NavigationIcon } from '@/components/navigation-icon';

/**
 * The header's right corner: the member's avatar leading to their profile, or «Войти» for guests. The avatar comes from
 * `/api/me/avatar` (a redirect to the cached image), so pages render without looking it up; without one, the icon stays.
 */
export function HeaderProfile({ signedIn, active }: { signedIn: boolean; active: boolean }) {
  const [failed, setFailed] = useState(false);
  // An image that failed before hydration never fires onError: check it when the element attaches.
  const watch = useCallback((image: HTMLImageElement | null) => { if (image?.complete && !image.naturalWidth) setFailed(true); }, []);
  if (!signedIn) return <Link className="header-profile is-guest" href="/sign-in" data-motion="sign-in" aria-label="Войти">
    <NavigationIcon section="sign-in" /><span>Войти</span>
  </Link>;
  return <Link className="header-profile" href="/profile" aria-label="Мой профиль" title="Мой профиль" data-motion="profile" aria-current={active ? 'page' : undefined}>
    {failed ? <NavigationIcon section="profile" />
      // eslint-disable-next-line @next/next/no-img-element -- a redirect to the stored avatar, not an optimizable asset
      : <img ref={watch} src="/api/me/avatar" alt="" width={36} height={36} onError={() => setFailed(true)} />}
  </Link>;
}
