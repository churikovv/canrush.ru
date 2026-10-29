'use client';

import { useState, useTransition } from 'react';
import { followCompanyAction } from '@/app/company/actions';
import Link from '@/components/navigation-progress';

/** «Подписаться» on a company: changes at once and rolls back on an error (the company profile and the drink page). */
export function CompanyFollowButton({ businessId, following: initial, followers: initialCount, signedIn }: { businessId: string; following: boolean; followers: number; signedIn: boolean }) {
  const [following, setFollowing] = useState(initial);
  const [count, setCount] = useState(initialCount);
  const [pending, startTransition] = useTransition();
  if (!signedIn) return <Link className="community-button company-follow" href="/sign-in">Подписаться</Link>;
  function toggle() {
    const next = !following;
    setFollowing(next);
    setCount(current => current + (next ? 1 : -1));
    startTransition(async () => {
      const result = await followCompanyAction(businessId, next);
      if (result.error) { setFollowing(!next); setCount(current => current - (next ? 1 : -1)); window.alert(result.error); }
      else if (result.followers !== undefined) setCount(result.followers);
    });
  }
  return <button type="button" className={`community-button company-follow${following ? ' is-following' : ''}`} aria-pressed={following} disabled={pending} onClick={toggle}
    title={`${count.toLocaleString('ru-RU')} подписчиков`}>
    {following ? <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg><span className="company-follow-long">Вы подписаны</span><span className="company-follow-short">Подписаны</span></> : 'Подписаться'}
  </button>;
}
