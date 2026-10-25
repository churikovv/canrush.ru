import '@/styles/shared.css';
import '@/styles/tierlists.css';
import '@/styles/profile.css';
import '@/styles/search.css';
import '@/styles/dating.css';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from '@/components/navigation-progress';
import { BrandShell } from '@/components/brand-shell';
import { NavigationIcon } from '@/components/navigation-icon';
import { DatingBrowser } from '@/components/dating-browser';
import { PeopleBrowser } from '@/components/people-browser';
import { ProfileNavigation } from '@/components/profile-navigation';
import { TierListsBrowser } from '@/components/tier-lists-browser';
import { seoMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { ...seoMetadata({ title: 'Сообщество', description: 'Тирлисты, дейтинг напитков и участники CanRush.', path: '/community' }), robots: { index: false } };

const SCOPES = [
  { key: 'tierlists', label: 'Тирлисты', icon: 'tierlists' },
  { key: 'dating', label: 'Дейтинг', icon: 'dating' },
  { key: 'people', label: 'Люди', icon: 'community' },
] as const;
type Scope = typeof SCOPES[number]['key'];

/** The tab bar's «Сообщество»: tier lists, drink dating and member search behind one pinned switcher, like /search. The feed is on the home page. */
export default async function CommunityPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  if (params.type === 'feed') redirect('/feed');
  const scope: Scope = SCOPES.find(item => item.key === params.type)?.key ?? 'tierlists';
  const text = (name: string) => typeof params[name] === 'string' ? params[name] : undefined;
  const scopes = <nav className="search-scopes" aria-label="Раздел сообщества">
    {SCOPES.map(item => <Link key={item.key} href={item.key === 'tierlists' ? '/community' : `/community?type=${item.key}`} aria-current={item.key === scope ? 'page' : undefined} replace scroll={false}><NavigationIcon section={item.icon} />{item.label}</Link>)}
  </nav>;
  // One surface and one pinned switcher for every tab, so it looks and sits the same everywhere (as on /search).
  return <BrandShell headerAction={<ProfileNavigation active="community" />} surfaceClassName="catalog-surface">
    <div className="search-layout community-layout" data-scope={scope}>
      {/* Tier lists have their own visible heading. */}
      {scope === 'people' && <h1 className="sr-only">Участники</h1>}
      <div className="search-pinned">{scopes}</div>
      {scope === 'tierlists' ? <TierListsBrowser params={{ q: text('q'), metric: text('metric'), more: text('more') }} basePath="/community" />
        : scope === 'dating' ? <DatingBrowser />
        : <PeopleBrowser q={text('q') ?? ''} />}
    </div>
  </BrandShell>;
}
