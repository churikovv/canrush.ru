import Link from '@/components/navigation-progress';

export function ProfileBackButton({ href = '/profile' }: { href?: string }) {
  return <Link className="profile-back-button community-button community-button-secondary" href={href}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m10 5-7 7 7 7M3 12h18" /></svg>
    В профиль
  </Link>;
}
