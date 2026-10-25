import '@/styles/shared.css';
import '@/styles/profile.css';
import '@/styles/feed.css';
import '@/styles/stories.css';
import { isResolvedFlavor } from '@canrush/shared';
import { BrandShell } from '@/components/brand-shell';
import { ProfileNavigation } from '@/components/profile-navigation';
import { HomeMetrics } from '@/components/home-metrics';
import { HomeStories } from '@/components/home-stories';
import { loadAllCatalogGroups, loadCatalogSnapshot } from '@/lib/catalog';
import { withCatalogDrinks } from '@/lib/catalog-drinks';
import { catalogMetrics, getHomeCounts } from '@/lib/home-metrics';
import { getMonthlyTop, settleMonthlyTop } from '@/lib/monthly-top';
import { DEFAULT_DESCRIPTION, seoMetadata } from '@/lib/seo';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { FeedBrowser } from '@/components/feed-browser';
import { HomeEvents } from '@/components/home-events';
import { currentContest } from '@/lib/contest';
import { getContestEntry } from '@/lib/contest-db';
import { getBetaEngine } from '@/lib/beta-engine';
export const dynamic = 'force-dynamic';
export const metadata = seoMetadata({ title: 'Энергетики, отзывы и рейтинг пользователей', description: DEFAULT_DESCRIPTION, path: '/' });

/** Mobile-first home: stories (with the Telegram one), totals, short event banners and the endless feed. */
export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { story } = await searchParams;
  const { groups } = await loadCatalogSnapshot();
  await settleMonthlyTop();
  const contest = currentContest(new Date());
  const [monthly, session, counts, allGroups] = await Promise.all([getMonthlyTop(), auth.api.getSession({ headers: await headers() }), getHomeCounts(), loadAllCatalogGroups()]);
  const resolved = groups.filter(group => isResolvedFlavor(group.flavor));
  const [contestEntry, engine] = await Promise.all([contest && session ? getContestEntry(contest.contest, session.user.id) : null, getBetaEngine(session?.user.id ?? null)]);
  return <BrandShell headerAction={<ProfileNavigation active="home" />} surfaceClassName="catalog-surface home-surface">
    <div className="home-layout">
      <h1 className="sr-only">CanRush — социальная сеть для энергокомьюнити: лента, цены и рейтинги энергетиков</h1>
      <HomeStories viewerId={session?.user.id ?? null} groups={await withCatalogDrinks(resolved)} openStory={typeof story === 'string' ? story : undefined} />
      <HomeMetrics data={{ ...counts, ...catalogMetrics(resolved, allGroups) }} />
      <HomeEvents monthly={{ month: monthly.month, leader: monthly.leaders[0]?.username ?? null }} contest={contest} joined={Boolean(contestEntry?.cans)} engine={engine} signedIn={Boolean(session)} />
      <section aria-labelledby="home-feed" className="home-section home-feed">
        {/* No visible heading: the feed simply continues the page; screen readers still get the section name. */}
        <h2 id="home-feed" className="sr-only">Лента</h2>
        <FeedBrowser query={{}} viewerId={session?.user.id ?? null} embedded />
      </section>
    </div>
  </BrandShell>;
}
