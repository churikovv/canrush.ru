import { VerifiedMark } from '@/components/verified-mark';
import { ArticleLikeButton } from '@/components/article-actions';
import { AtmKeyFace } from '@/components/atm-key';
import { BigCard, type ShownCard } from '@/components/big-card';
import { InspectableCard } from '@/components/card-inspector';
import { FeedDrop } from '@/components/feed-drop';
import { skinSummary } from '@/lib/can-skin';
import { RARITY_LABELS } from '@/lib/gacha-fields';
import Image from 'next/image';
import Link from '@/components/navigation-progress';
import { TierListCard, type TierCardViewer } from '@/components/tier-list-card';
import { TierLikeButton } from '@/components/tier-like-button';
import { FeedReviewsMore } from '@/components/feed-reviews-more';
import type { ReviewInteraction } from '@/lib/review-discussions';
import { displayName } from '@/components/wall-post';
import { catalogGroupSlug, flavorName } from '@/lib/catalog-query';
import { profileTagKey, profileTagLabel } from '@/lib/profile-achievements';
import type { FeedArticleRow, FeedGachaRow, FeedQuestionRow, FeedReviewGroup } from '@/lib/profile-community';
import { answersWord } from '@/lib/drink-question-fields';
import type { TierListProduct, TierListSummary } from '@/lib/tier-list-types';

const eventTime = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Moscow' });
/** Shown in a «оценил напитки» event; the rest wait in a stack under it and open in place (they are already loaded). */
export const REVIEWS_SHOWN = 1;
/**
 * Reviews of one event rendered into the page at most: a day of thirty reviews would otherwise put thirty cards with
 * covers into the feed HTML (slow on budget phones). The rest are on the author's reviews page.
 */
export const REVIEWS_IN_FEED = 5;

/** `tag` — the selected tag as a key or a label (reviews carry the label). */
interface EventAuthor { username: string; name: string; avatarId: string | null; tag: string | null; verified?: boolean }

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
      <p><Link className="wall-post-author" href={href}>{name}</Link>{author.verified && <VerifiedMark />}{tag && <span className="profile-tag" data-tag={tag}>{profileTagLabel(tag)}</span>}</p>
      <p className="feed-event-action">{action} · <time dateTime={at.toISOString()}>{eventTime.format(at)}</time></p>
    </div>
  </header>;
}

/** «Опубликовал статью»: обложка, заголовок и лид ведут на статью, лайк общий с её страницей. */
export function FeedArticleEvent({ article, viewerId }: { article: FeedArticleRow; viewerId: string | null }) {
  return <article className="feed-event" id={`feed-article-${article.id}`}>
    <EventHead author={article} action="опубликовал статью" at={article.publishedAt} />
    <Link className="feed-article" href={`/news/${article.id}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- served from the database */}
      {article.coverId && <img className="feed-article-cover" src={`/api/article-images/${article.coverId}?thumb`} alt="" loading="lazy" />}
      <span className="feed-article-body">
        <strong>{article.title}</strong>
        {article.summary && <span className="feed-article-summary">{article.summary}</span>}
        <small>{article.minutes} мин чтения</small>
      </span>
    </Link>
    <div className="feed-article-foot"><ArticleLikeButton id={article.id} likes={article.likes} liked={article.liked} own={viewerId === article.userId} signedIn={Boolean(viewerId)} /></div>
  </article>;
}

/**
 * «Спросил о напитке»: обложка, бренд и вкус, сам вопрос и сколько ответов; всё ведёт в окно вопросов на странице напитка,
 * к этому вопросу, где на него и отвечают.
 */
export function FeedQuestionEvent({ question, covers }: { question: FeedQuestionRow; covers: Map<string, string> }) {
  const cover = covers.get(`${question.brand}\u0000${question.flavor}`);
  const href = `/catalog/${catalogGroupSlug(question.brand, question.flavor)}?tab=questions#question-${question.id}`;
  return <article className="feed-event" id={`feed-question-${question.id}`}>
    <EventHead author={question} action="спросил о напитке" at={question.createdAt} />
    <Link className="feed-question" href={href}>
      <span className="feed-question-drink">
        <span className="feed-question-cover">{cover ? <Image src={cover} width={48} height={48} sizes="48px" unoptimized alt="" /> : question.brand.slice(0, 2).toLocaleUpperCase('ru-RU')}</span>
        <span><b>{question.brand}</b><small>{flavorName(question.flavor)}</small></span>
      </span>
      <span className="feed-question-text">{question.text}</span>
      <span className="feed-question-foot">{question.answers > 0 ? `${question.answers} ${answersWord(question.answers)}` : 'Пока без ответа'}<span aria-hidden="true">Ответить →</span></span>
    </Link>
  </article>;
}

/** «Опубликовал тирлист»: the same card as in the tier lists section, with its likes. */
export function FeedTierListEvent({ list, products, viewer }: { list: TierListSummary; products: TierListProduct[]; viewer: TierCardViewer }) {
  return <article className="feed-event" id={`feed-tierlist-${list.id}`}>
    <EventHead author={{ username: list.author.username, name: list.author.name, avatarId: list.author.avatarId ?? null, tag: list.author.tag ?? null, verified: list.author.verified }} action="опубликовал тирлист" at={list.publishedAt ?? list.createdAt} />
    <TierListCard list={list} products={products} viewer={viewer} />
  </article>;
}

/** «Вытащил легенду»: лучшая эпическая или легендарная банка дня из Банкомата — карточка в цвете редкости. */
/**
 * «Достал из Банкомата»: the card itself on a dark stage in its rarity's colour — rays turn behind it, it falls in with a
 * flash the first time it is seen and sways (`FeedDrop`), a day of several pulls fans out the cards behind it. A tap opens
 * the big view, where the card is turned and its look plays; under it, the rarity, the drink and its rarest traits.
 */
/** Traits of a dropped card in the order worth showing: the motion of rarer cards before the frame and the pattern. */
const SHOWY = ['Фольга', 'Частицы', 'Эффект', 'Мир', 'Рамка', 'Свет', 'Орнамент'];
export function FeedGachaEvent({ pull, covers }: { pull: FeedGachaRow; covers: Map<string, string> }) {
  const label = pull.rarity === 'legendary' ? 'легендарную' : 'эпическую';
  const action = `достал из Банкомата ${label} банку${pull.count > 1 ? ` · за день ${pull.count}` : ''}`;
  const href = `/catalog/${catalogGroupSlug(pull.brand, pull.flavor)}`;
  const card: ShownCard = { brand: pull.brand, flavor: pull.flavor, name: flavorName(pull.flavor), cover: covers.get(`${pull.brand}\u0000${pull.flavor}`) ?? '', href, rarity: pull.rarity };
  const { traits } = skinSummary(pull.brand, pull.flavor, pull.rarity);
  // Rare traits first, then what only rarer cards have: that is what makes this card worth a look.
  const shown = [...traits].sort((a, b) => Number(b.rare) - Number(a.rare) || SHOWY.indexOf(a.kind) - SHOWY.indexOf(b.kind)).slice(0, 3);
  return <article className="feed-event" id={`feed-gacha-${pull.key}`}>
    <EventHead author={pull} action={action} at={pull.createdAt} />
    <div className="feed-drop" data-rarity={pull.rarity}>
      <FeedDrop>
        <span className="feed-drop-rays" aria-hidden="true" />
        {pull.count > 1 && <><span className="feed-drop-ghost" aria-hidden="true" /><span className="feed-drop-ghost" aria-hidden="true" /></>}
        <span className="feed-drop-burst" aria-hidden="true" />
        <div className="feed-drop-sway">
          <InspectableCard className="feed-drop-card" card={card}>
            <BigCard card={card} live />
            <span className="feed-drop-zoom" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg></span>
          </InspectableCard>
          <span className="feed-drop-glare" aria-hidden="true" />
        </div>
      </FeedDrop>
      <div className="feed-drop-copy">
        <span className="feed-drop-kicker">{RARITY_LABELS[pull.rarity]}{pull.count > 1 ? ` · ${pull.count} за день` : ''}</span>
        <Link className="feed-drop-name" href={href}><b>{pull.brand}</b><span>{card.name}</span></Link>
        <ul className="card-traits" aria-label="Облик">{shown.map(item => <li key={item.kind} data-rare={item.rare || undefined}><small>{item.kind}</small>{item.name}{item.rare && <b aria-label="редкий"> ✦</b>}</li>)}</ul>
        <Link className="atm-key feed-drop-try" data-tone="gold" href="/gacha"><AtmKeyFace label="Крутить Банкомат" /></Link>
      </div>
    </div>
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
  const renderReview = (review: FeedReviewGroup['reviews'][number]) => {
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
  };
  return <article className="feed-event" id={`feed-reviews-${group.key}`}>
    <EventHead author={author} action={action} at={group.createdAt} />
    <ul className="feed-reviews">
      {group.reviews.slice(0, REVIEWS_SHOWN).map(renderReview)}
      {count > REVIEWS_SHOWN && <FeedReviewsMore hidden={count - REVIEWS_SHOWN}>
        {group.reviews.slice(REVIEWS_SHOWN, REVIEWS_IN_FEED).map(renderReview)}
        {count > REVIEWS_IN_FEED && <li className="feed-reviews-all"><Link href={`/profile/${first.author.username}/reviews`}>Все отзывы @{first.author.username} · ещё {count - REVIEWS_IN_FEED}</Link></li>}
      </FeedReviewsMore>}
    </ul>
  </article>;
}
