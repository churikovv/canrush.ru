import '@/styles/shared.css';
import '@/styles/tierlists.css';
import '@/styles/profile.css';
import '@/styles/feed.css';
import '@/styles/search.css';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from '@/components/navigation-progress';
import { BrandShell } from '@/components/brand-shell';
import { FeedBrowser } from '@/components/feed-browser';
import { PeopleBrowser } from '@/components/people-browser';
import { ProfileNavigation } from '@/components/profile-navigation';
import { TierListsBrowser } from '@/components/tier-lists-browser';
import { auth } from '@/lib/auth';
import { seoMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { ...seoMetadata({ title: 'Сообщество', description: 'Тирлисты, лента и участники CanRush.', path: '/community' }), robots: { index: false } };

const SCOPES = [
  { key: 'tierlists', label: 'Тирлисты' },
  { key: 'feed', label: 'Лента' },
  { key: 'people', label: 'Люди' },
] as const;
type Scope = typeof SCOPES[number]['key'];

/** The tab bar's «Сообщество»: tier lists, the feed and member search behind one pinned switcher, like /search. */
export default async function CommunityPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const scope: Scope = SCOPES.find(item => item.key === params.type)?.key ?? 'tierlists';
  const text = (name: string) => typeof params[name] === 'string' ? params[name] : undefined;
  const keep: Record<string, string> = scope === 'tierlists' ? {} : { type: scope };
  const scopes = <nav className="search-scopes" aria-label="Раздел сообщества">
    {SCOPES.map(item => <Link key={item.key} href={item.key === 'tierlists' ? '/community' : `/community?type=${item.key}`} aria-current={item.key === scope ? 'page' : undefined} replace scroll={false}>{item.label}</Link>)}
  </nav>;
  const viewerId = scope === 'feed' ? (await auth.api.getSession({ headers: await headers() }))?.user.id ?? null : null;
  return <BrandShell headerAction={<ProfileNavigation active="community" />} surfaceClassName={scope === 'tierlists' ? 'tierlists-surface' : 'profile-surface'}>
    <div className="search-layout" data-scope={scope}>
      {/* Tier lists have their own visible heading. */}
      {scope !== 'tierlists' && <h1 className="sr-only">{scope === 'feed' ? 'Лента' : 'Участники'}</h1>}
      {scope === 'tierlists' ? <TierListsBrowser params={{ q: text('q'), metric: text('metric') }} basePath="/community" scopes={scopes} />
        : scope === 'feed' ? <FeedBrowser query={{ page: text('page') }} viewerId={viewerId} basePath="/community" keep={keep} scopes={scopes} />
        : <PeopleBrowser q={text('q') ?? ''} basePath="/community" keep={keep} scopes={scopes} />}
    </div>
  </BrandShell>;
}
