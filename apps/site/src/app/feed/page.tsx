import '@/styles/shared.css';
import '@/styles/profile.css';
import '@/styles/feed.css';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { BrandShell } from '@/components/brand-shell';
import { ProfileNavigation } from '@/components/profile-navigation';
import { FeedBrowser, type FeedSearchParams } from '@/components/feed-browser';
import { auth } from '@/lib/auth';
import { seoMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = seoMetadata({
  title: 'Лента',
  description: 'Свежие записи со стен участников CanRush: впечатления об энергетиках, фото и обсуждения.',
  path: '/feed',
});

export default async function FeedPage({ searchParams }: { searchParams: Promise<FeedSearchParams> }) {
  const query = await searchParams;
  const session = await auth.api.getSession({ headers: await headers() });
  return (
    <BrandShell headerAction={<ProfileNavigation active="feed" />} surfaceClassName="profile-surface">
      <FeedBrowser query={query} viewerId={session?.user.id ?? null} />
    </BrandShell>
  );
}
