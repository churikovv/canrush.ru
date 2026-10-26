import Link from '@/components/navigation-progress';
import { FeedReviewsEvent, FeedTierListEvent } from '@/components/feed-activity';
import { WallComposer } from '@/components/profile-community-controls';
import { PagePagination } from '@/components/page-pagination';
import { RankUpCard } from '@/components/rank-up-card';
import { FeedTabs } from '@/components/section-tabs';
import { WallPost } from '@/components/wall-post';
import { profilePageNumber } from '@/lib/profile-achievements';
import type { ReactNode } from 'react';
import { FeedMore } from '@/components/feed-more';
import { getFeed, type FeedItem, type FeedScope } from '@/lib/profile-community';
import { getReviewInteractions } from '@/lib/review-discussions';
import { getWallInteractions } from '@/lib/wall-discussions';
import { loadAllCatalogGroups } from '@/lib/catalog';
import { getTierCardViewer } from '@/lib/tier-discussions';
import { tierListProductsForPlacements } from '@/lib/tier-lists';
import { SignInPrompt } from '@/components/sign-in-prompt';

export type FeedSearchParams = { scope?: string; page?: string };

/**
 * The rows of one feed page: records, rank-ups, tier lists and review days, with what each needs to render (likes,
 * covers, tier list products). Shared by /feed, the home page and the infinite loading of the home feed.
 */
export async function renderFeedItems(items: FeedItem[], viewerId: string | null): Promise<ReactNode[]> {
  const posts = items.flatMap(item => item.kind === 'post' ? [item.post] : []);
  const tierLists = items.flatMap(item => item.kind === 'tierlist' ? [item.tierList] : []);
  const reviewIds = items.flatMap(item => item.kind === 'reviews' ? item.group.reviews.map(review => review.id) : []);
  const hasEvents = tierLists.length > 0 || reviewIds.length > 0;
  const [interactions, groups, tierViewer, reviewVotes] = await Promise.all([
    getWallInteractions(posts.map(post => post.id), viewerId),
    hasEvents ? loadAllCatalogGroups() : Promise.resolve([]),
    getTierCardViewer(tierLists.map(list => list.id), viewerId),
    getReviewInteractions(reviewIds, viewerId),
  ]);
  const tierProducts = tierListProductsForPlacements(groups, tierLists.flatMap(list => list.preview));
  const covers = new Map(groups.flatMap(group => group.coverImageUrl ? [[`${group.brand}\u0000${group.flavor}`, group.coverImageUrl] as const] : []));
  return items.map(item => item.kind === 'rank-up' ? <RankUpCard key={item.rankUp.id} rankUp={item.rankUp} />
    : item.kind === 'tierlist' ? <FeedTierListEvent key={`tierlist-${item.tierList.id}`} list={item.tierList} products={tierProducts} viewer={tierViewer} />
    : item.kind === 'reviews' ? <FeedReviewsEvent key={`reviews-${item.group.key}`} group={item.group} covers={covers} votes={reviewVotes} viewerId={viewerId} />
    : <WallPost key={item.post.id} post={item.post} owner={{ username: item.post.ownerUsername, name: item.post.ownerName, avatarId: item.post.ownerAvatarId }} interaction={interactions.get(item.post.id)} canDelete={viewerId === item.post.userId || viewerId === item.post.profileId} canEdit={viewerId === item.post.userId} />);
}

/**
 * Every wall as one timeline. /feed shows its heading, the «Все / Подписки / Сохранённые» tabs and pages; `embedded`
 * (the home page, under its own heading) shows everyone's records and keeps loading the next pages while scrolling.
 */
export async function FeedBrowser({ query, viewerId, basePath = '/feed', keep = {}, embedded = false }: { query: FeedSearchParams; viewerId: string | null; basePath?: string; keep?: Record<string, string>; embedded?: boolean }) {
  const scope: FeedScope = !embedded && viewerId && (query.scope === 'following' || query.scope === 'saved') ? query.scope : 'all';
  const page = embedded ? 1 : profilePageNumber(query.page);
  const feed = await getFeed(viewerId, scope, page);
  const items = feed.items;
  const nodes = await renderFeedItems(items, viewerId);
  const pageHref = (target: number) => {
    const params = new URLSearchParams({ ...keep, ...(scope !== 'all' ? { scope } : {}) });
    if (target > 1) params.set('page', String(target));
    const search = params.toString();
    return search ? `${basePath}?${search}` : basePath;
  };

  const tabs = <FeedTabs active={scope} signedIn={Boolean(viewerId)} basePath={basePath} keep={keep} />;
  return (
    <div className="feed-layout">
      {!embedded && <div className="community-section-heading feed-heading">
        <div><h1>Лента</h1><p className="community-section-note">Записи со всех стен. То, что вы публикуете здесь, появляется и на вашей стене.</p></div>
      </div>}
      {!embedded && tabs}
      <section className="community-panel feed-composer" aria-label="Новая запись">
        {viewerId ? <WallComposer targetId={viewerId} label="Новая запись в ленте и на вашей стене" placeholder="Что нового? Запись появится и на вашей стене…" /> : <SignInPrompt title="Поделитесь с сообществом" text="Войдите, чтобы писать в ленту, ставить лайки и отвечать на записи." />}
      </section>
      <section className="feed-posts" aria-label="Записи">
        {items.length ? <div className="wall-comments">{nodes}{embedded && feed.hasMore && <FeedMore />}</div>
          : <div className="wall-empty-card">{scope === 'saved'
            ? <><strong>Сохранённых записей нет</strong><p>Нажмите на закладку под записью, чтобы вернуться к ней здесь.</p></>
            : scope === 'following'
            ? <><strong>Подписок пока нет</strong><p>Подпишитесь на участников из <Link href="/leaderboard">рейтинга</Link>, чтобы видеть их записи здесь.</p></>
            : <><strong>Здесь пока тихо</strong><p>Напишите первую запись — она появится и на вашей стене.</p></>}</div>}
        {!embedded && <PagePagination page={page} pages={feed.pages} href={pageHref} label="Страницы ленты" previousLabel="Новее" nextLabel="Старее" />}
      </section>
    </div>
  );
}
