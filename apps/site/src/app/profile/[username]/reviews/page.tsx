import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BrandShell } from '@/components/brand-shell';
import { ProfileNavigation } from '@/components/profile-navigation';
import { ProfileReviews } from '@/components/profile-reviews';
import { getProfileByUsername } from '@/lib/profile';
import { getReviewsForUser, PROFILE_REVIEWS_PAGE_SIZE } from '@/lib/reviews';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Отзывы пользователя',
  robots: { index: false, follow: false },
};

export default async function ProfileReviewsPage({ params, searchParams }: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const [{ username }, query] = await Promise.all([params, searchParams]);
  const profile = await getProfileByUsername(username);
  if (!profile) notFound();
  const pages = Math.max(1, Math.ceil(profile.reviewCount / PROFILE_REVIEWS_PAGE_SIZE));
  const requested = typeof query.page === 'string' ? Number(query.page) : 1;
  const page = Number.isSafeInteger(requested) && requested > 0 ? Math.min(requested, pages) : 1;
  const session = await auth.api.getSession({ headers: await headers() });
  const reviews = await getReviewsForUser(profile.id, page, session?.user.id ?? null);
  const ownerName = profile.name.trim() && !profile.name.includes('@') ? profile.name : profile.username;

  return (
    <BrandShell headerAction={<ProfileNavigation active="profile" />} surfaceClassName="profile-surface">
      <ProfileReviews reviews={reviews} username={profile.username} ownerName={ownerName} count={profile.reviewCount} page={page} pages={pages} />
    </BrandShell>
  );
}
