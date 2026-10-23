import Link from '@/components/navigation-progress';
import { FeedReviewsEvent, FeedTierListEvent } from '@/components/feed-activity';
import { WallComposer } from '@/components/profile-community-controls';
import { PagePagination } from '@/components/page-pagination';
import { RankUpCard } from '@/components/rank-up-card';
import { FeedTabs } from '@/components/section-tabs';
import { WallPost } from '@/components/wall-post';
import { profilePageNumber } from '@/lib/profile-achievements';
import { getFeed, type FeedScope } from '@/lib/profile-community';
import { getWallInteractions } from '@/lib/wall-discussions';
import { loadAllCatalogGroups } from '@/lib/catalog';
import { getTierCardViewer } from '@/lib/tier-discussions';
import { tierListProductsForPlacements } from '@/lib/tier-lists';

export type FeedSearchParams = { scope?: string; page?: string };

/**
 * Every wall as one timeline. /feed shows its heading and the «Все / Подписки / Сохранённые» tabs; `embedded` (the home
 * page, under its own heading) shows everyone's records only, the first `limit` of them, with a link to /feed.
 */
export async function FeedBrowser({ query, viewerId, basePath = '/feed', keep = {}, embedded = false, limit }: { query: FeedSearchParams; viewerId: string | null; basePath?: string; keep?: Record<string, string>; embedded?: boolean; limit?: number }) {
  const scope: FeedScope = !embedded && viewerId && (query.scope === 'following' || query.scope === 'saved') ? query.scope : 'all';
  const page = profilePageNumber(query.page);
  const feed = await getFeed(viewerId, scope, page);
  const items = limit ? feed.items.slice(0, limit) : feed.items;
  const tierLists = items.flatMap(item => item.kind === 'tierlist' ? [item.tierList] : []);
  const hasEvents = tierLists.length > 0 || items.some(item => item.kind === 'reviews');
  const [interactions, groups, tierViewer] = await Promise.all([
    getWallInteractions(feed.posts.map(post => post.id), viewerId),
    hasEvents ? loadAllCatalogGroups() : Promise.resolve([]),
    getTierCardViewer(tierLists.map(list => list.id), viewerId),
  ]);
  const tierProducts = tierListProductsForPlacements(groups, tierLists.flatMap(list => list.preview));
  const covers = new Map(groups.flatMap(group => group.coverImageUrl ? [[`${group.brand}\u0000${group.flavor}`, group.coverImageUrl] as const] : []));
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
        {viewerId ? <WallComposer targetId={viewerId} label="Новая запись в ленте и на вашей стене" placeholder="Что нового? Запись появится и на вашей стене…" /> : <p className="community-empty"><Link href="/sign-in">Войдите</Link>, чтобы написать в ленту.</p>}
      </section>
      <section className="feed-posts" aria-label="Записи">
        {items.length ? <div className="wall-comments">{items.map(item => item.kind === 'rank-up' ? <RankUpCard key={item.rankUp.id} rankUp={item.rankUp} />
          : item.kind === 'tierlist' ? <FeedTierListEvent key={`tierlist-${item.tierList.id}`} list={item.tierList} products={tierProducts} viewer={tierViewer} />
          : item.kind === 'reviews' ? <FeedReviewsEvent key={`reviews-${item.group.key}`} group={item.group} covers={covers} />
          : <WallPost key={item.post.id} post={item.post} owner={{ username: item.post.ownerUsername, name: item.post.ownerName, avatarId: item.post.ownerAvatarId }} interaction={interactions.get(item.post.id)} canDelete={viewerId === item.post.userId || viewerId === item.post.profileId} canEdit={viewerId === item.post.userId} />)}</div>
          : <div className="wall-empty-card">{scope === 'saved'
            ? <><strong>Сохранённых записей нет</strong><p>Нажмите на закладку под записью, чтобы вернуться к ней здесь.</p></>
            : scope === 'following'
            ? <><strong>Подписок пока нет</strong><p>Подпишитесь на участников из <Link href="/leaderboard">рейтинга</Link>, чтобы видеть их записи здесь.</p></>
            : <><strong>Здесь пока тихо</strong><p>Напишите первую запись — она появится и на вашей стене.</p></>}</div>}
        {limit ? feed.items.length > limit || feed.pages > 1 ? <Link className="feed-more" href="/feed">Вся лента</Link> : null
          : <PagePagination page={page} pages={feed.pages} href={pageHref} label="Страницы ленты" previousLabel="Новее" nextLabel="Старее" />}
      </section>
    </div>
  );
}
