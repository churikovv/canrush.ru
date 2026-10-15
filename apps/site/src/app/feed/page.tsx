import '@/styles/shared.css';
import '@/styles/profile.css';
import '@/styles/feed.css';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from '@/components/navigation-progress';
import { BrandShell } from '@/components/brand-shell';
import { ProfileNavigation } from '@/components/profile-navigation';
import { WallComposer } from '@/components/profile-community-controls';
import { FeedTabs } from '@/components/section-tabs';
import { WallPost } from '@/components/wall-post';
import { auth } from '@/lib/auth';
import { profilePageNumber } from '@/lib/profile-achievements';
import { getFeed, type FeedScope } from '@/lib/profile-community';
import { seoMetadata } from '@/lib/seo';
import { getWallInteractions } from '@/lib/wall-discussions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = seoMetadata({
  title: 'Лента',
  description: 'Свежие записи со стен участников CanRush: впечатления об энергетиках, фото и обсуждения.',
  path: '/feed',
});

export default async function FeedPage({ searchParams }: { searchParams: Promise<{ scope?: string; page?: string }> }) {
  const query = await searchParams;
  const session = await auth.api.getSession({ headers: await headers() });
  const viewerId = session?.user.id ?? null;
  const scope: FeedScope = query.scope === 'following' && viewerId ? 'following' : 'all';
  const page = profilePageNumber(query.page);
  const feed = await getFeed(viewerId, scope, page);
  const interactions = await getWallInteractions(feed.posts.map(post => post.id), viewerId);
  const pageHref = (target: number) => {
    const params = new URLSearchParams(scope === 'following' ? { scope } : {});
    if (target > 1) params.set('page', String(target));
    const search = params.toString();
    return search ? `/feed?${search}` : '/feed';
  };

  return (
    <BrandShell headerAction={<ProfileNavigation active="feed" />} surfaceClassName="profile-surface">
      <div className="feed-layout">
        <div className="community-section-heading feed-heading">
          <div><h1>Лента</h1><p className="community-section-note">Записи со всех стен. То, что вы публикуете здесь, появляется и на вашей стене.</p></div>
        </div>
        <FeedTabs active={scope} signedIn={Boolean(viewerId)} />
        <section className="community-panel feed-composer" aria-label="Новая запись">
          {viewerId ? <WallComposer targetId={viewerId} label="Новая запись в ленте и на вашей стене" placeholder="Что нового? Запись появится и на вашей стене…" /> : <p className="community-empty"><Link href="/sign-in">Войдите</Link>, чтобы написать в ленту.</p>}
        </section>
        <section className="feed-posts" aria-label="Записи">
          {feed.posts.length ? <div className="wall-comments">{feed.posts.map(post => <WallPost key={post.id} post={post} owner={{ username: post.ownerUsername, name: post.ownerName }} interaction={interactions.get(post.id)} canDelete={viewerId === post.userId || viewerId === post.profileId} />)}</div>
            : <div className="wall-empty-card">{scope === 'following'
              ? <><strong>Подписок пока нет</strong><p>Подпишитесь на участников из <Link href="/leaderboard">рейтинга</Link>, чтобы видеть их записи здесь.</p></>
              : <><strong>Здесь пока тихо</strong><p>Напишите первую запись — она появится и на вашей стене.</p></>}</div>}
          {(page > 1 || feed.hasMore) && <nav className="community-pagination" aria-label="Страницы ленты">{page > 1 ? <Link href={pageHref(page - 1)}>← Новее</Link> : <span />}<span>{page}</span>{feed.hasMore ? <Link href={pageHref(page + 1)}>Старее →</Link> : <span />}</nav>}
        </section>
      </div>
    </BrandShell>
  );
}
