import Image from 'next/image';
import Link from '@/components/navigation-progress';
import { TierListCard, type TierCardViewer } from '@/components/tier-list-card';
import { TierLikeButton } from '@/components/tier-like-button';
import type { ReviewInteraction } from '@/lib/review-discussions';
import { displayName } from '@/components/wall-post';
import { catalogGroupSlug, flavorName } from '@/lib/catalog-query';
import { profileTagKey, profileTagLabel } from '@/lib/profile-achievements';
import type { FeedReviewGroup } from '@/lib/profile-community';
import type { TierListProduct, TierListSummary } from '@/lib/tier-list-types';

const eventTime = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Moscow' });
/** Shown in a «оценил напитки» event; the rest are one link away on the profile. */
export const REVIEWS_SHOWN = 3;

/** `tag` — the selected tag as a key or a label (reviews carry the label). */
interface EventAuthor { username: string; name: string; avatarId: string | null; tag: string | null }

/** The row head of a feed event: avatar, name, tag, what they did and when. */
function EventHead({ author, action, at }: { author: EventAuthor; action: string; at: Date }) {
  const href = `/profile/${author.username}`;
  const name = displayName(author);
  const tag = profileTagKey(author.tag);
  return <header className="feed-event-head">
    <Link className="wall-avatar feed-event-avatar" href={href} tabIndex={-1} aria-hidden="true">
      {author.avatarId ? <Image src={`/api/profile-images/${author.avatarId}`} width={40} height={40} unoptimized alt="" /> : name.slice(0, 1).toLocaleUpperCase('ru-RU')}
    </Link>
    <div className="feed-event-who">
      <p><Link className="wall-post-author" href={href}>{name}</Link>{tag && <span className="profile-tag" data-tag={tag}>{profileTagLabel(tag)}</span>}</p>
      <p className="feed-event-action">{action} · <time dateTime={at.toISOString()}>{eventTime.format(at)}</time></p>
    </div>
  </header>;
}

/** «Опубликовал тирлист»: the same card as in the tier lists section, with its likes. */
export function FeedTierListEvent({ list, products, viewer }: { list: TierListSummary; products: TierListProduct[]; viewer: TierCardViewer }) {
  return <article className="feed-event" id={`feed-tierlist-${list.id}`}>
    <EventHead author={{ username: list.author.username, name: list.author.name, avatarId: list.author.avatarId ?? null, tag: list.author.tag ?? null }} action="опубликовал тирлист" at={list.publishedAt ?? list.createdAt} />
    <TierListCard list={list} products={products} viewer={viewer} />
  </article>;
}

function Star() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.3l6.5-.9z" /></svg>;
}

/** «Оценил напитки»: a member's reviews of one day, each a drink with its score, the start of the text and a like. */
export function FeedReviewsEvent({ group, covers, votes, viewerId }: { group: FeedReviewGroup; covers: Map<string, string>; votes: Map<string, ReviewInteraction>; viewerId: string | null }) {
  const authorId = group.key.split('|')[0];
  const first = group.reviews[0]!;
  const author = { username: first.author.username, name: first.author.name, avatarId: first.author.avatarId, tag: first.author.tag };
  const count = group.reviews.length;
  const action = count === 1 ? 'оценил напиток' : `оценил ${count} ${count < 5 ? 'напитка' : 'напитков'}`;
  return <article className="feed-event" id={`feed-reviews-${group.key}`}>
    <EventHead author={author} action={action} at={group.createdAt} />
    <ul className="feed-reviews">
      {group.reviews.slice(0, REVIEWS_SHOWN).map(review => {
        const cover = covers.get(`${review.brand}\u0000${review.flavor}`);
        const overall = (review.design + review.taste) / 2;
        const vote = votes.get(review.id);
        return <li key={review.id} className="feed-review-item"><Link className="feed-review" href={`/catalog/${catalogGroupSlug(review.brand, review.flavor)}?tab=reviews#review-${review.id}`}>
          <span className="feed-review-cover">{cover ? <Image src={cover} width={112} height={144} sizes="112px" alt="" /> : review.brand.slice(0, 2).toLocaleUpperCase('ru-RU')}</span>
          <span className="feed-review-copy">
            <span className="feed-review-brand">{review.brand}</span>
            <b className="feed-review-name">{flavorName(review.flavor)}</b>
            <span className="feed-review-scores">
              <span className="feed-review-overall" aria-label={`Оценка ${overall.toFixed(1)} из 10`}><Star /><strong>{overall.toFixed(1)}</strong></span>
              <span className="feed-review-criteria">Дизайн <b>{review.design.toFixed(1)}</b> · Вкус <b>{review.taste.toFixed(1)}</b></span>
            </span>
            <span className="feed-review-text">{review.text}</span>
          </span>
        </Link>
        <span className="feed-review-like"><TierLikeButton kind="review" id={review.id} likes={vote?.likes ?? 0} vote={vote?.vote ?? 0} signedIn={Boolean(viewerId)} own={viewerId === authorId} /></span>
        </li>;
      })}
    </ul>
    {count > REVIEWS_SHOWN && <Link className="feed-event-more" href={`/profile/${author.username}/reviews`}>Ещё {count - REVIEWS_SHOWN} — все отзывы</Link>}
  </article>;
}
