import Link from '@/components/navigation-progress';
import { WallComposer } from '@/components/profile-community-controls';
import { FeedTabs } from '@/components/section-tabs';
import { WallPost } from '@/components/wall-post';
import { profilePageNumber } from '@/lib/profile-achievements';
import { getFeed, type FeedScope } from '@/lib/profile-community';
import { getWallInteractions } from '@/lib/wall-discussions';

export type FeedSearchParams = { scope?: string; page?: string };

/**
 * Every wall as one timeline. /feed shows its heading and the «Все записи / Подписки» tabs; `embedded` (/community,
 * under its own switcher) shows everyone's records only.
 */
export async function FeedBrowser({ query, viewerId, basePath = '/feed', keep = {}, embedded = false }: { query: FeedSearchParams; viewerId: string | null; basePath?: string; keep?: Record<string, string>; embedded?: boolean }) {
  const scope: FeedScope = !embedded && query.scope === 'following' && viewerId ? 'following' : 'all';
  const page = profilePageNumber(query.page);
  const feed = await getFeed(viewerId, scope, page);
  const interactions = await getWallInteractions(feed.posts.map(post => post.id), viewerId);
  const pageHref = (target: number) => {
    const params = new URLSearchParams({ ...keep, ...(scope === 'following' ? { scope } : {}) });
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
        {feed.posts.length ? <div className="wall-comments">{feed.posts.map(post => <WallPost key={post.id} post={post} owner={{ username: post.ownerUsername, name: post.ownerName, avatarId: post.ownerAvatarId }} interaction={interactions.get(post.id)} canDelete={viewerId === post.userId || viewerId === post.profileId} canEdit={viewerId === post.userId} />)}</div>
          : <div className="wall-empty-card">{scope === 'following'
            ? <><strong>Подписок пока нет</strong><p>Подпишитесь на участников из <Link href="/leaderboard">рейтинга</Link>, чтобы видеть их записи здесь.</p></>
            : <><strong>Здесь пока тихо</strong><p>Напишите первую запись — она появится и на вашей стене.</p></>}</div>}
        {(page > 1 || feed.hasMore) && <nav className="community-pagination" aria-label="Страницы ленты">{page > 1 ? <Link href={pageHref(page - 1)}>← Новее</Link> : <span />}<span>{page}</span>{feed.hasMore ? <Link href={pageHref(page + 1)}>Старее →</Link> : <span />}</nav>}
      </section>
    </div>
  );
}
