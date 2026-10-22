import Image from 'next/image';
import Link from '@/components/navigation-progress';
import { TierLikeButton } from '@/components/tier-like-button';
import { TIER_KEYS, type TierListProduct, type TierListSummary } from '@/lib/tier-list-types';

interface TierListCardProps {
  list: TierListSummary;
  products: TierListProduct[];
  showStatus?: boolean;
  /** Who is looking and their votes by list id, for the like button (a guest has no id). */
  viewer?: TierCardViewer;
}

export interface TierCardViewer { id: string | null; votes: Map<string, number> }

function itemKey(brand: string, flavor: string): string {
  return `${brand}\u0000${flavor}`;
}

const count = new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 });

/** A tier list in a grid: emoji and title, author, likes, a miniature of the filled sections and the open button. */
export function TierListCard({ list, products, showStatus = false, viewer }: TierListCardProps) {
  const productByKey = new Map(products.map((product) => [itemKey(product.brand, product.flavor), product]));
  const published = list.status === 'published';
  const href = published ? `/tierlists/${list.slug}` : `/tierlists/${list.slug}/edit`;
  const author = list.author.name.trim() && !list.author.name.includes('@') ? list.author.name : list.author.username;
  const rows = TIER_KEYS.filter((tier) => list.tiers.includes(tier) && (list.tierCounts[tier] ?? 0) > 0);

  return (
    <article className="tier-list-card">
      <header className="tier-list-card-head">
        {list.emoji ? <span className="tier-list-card-emoji" aria-hidden="true">{list.emoji}</span> : null}
        <div className="tier-list-card-title">
          <h3><Link href={href}>{list.title}</Link></h3>
          <Link className="tier-list-card-author" href={`/profile/${list.author.username}`}>
            {list.author.avatarId
              ? <Image src={`/api/profile-images/${list.author.avatarId}`} width={20} height={20} unoptimized alt="" />
              : <span aria-hidden="true">{author.slice(0, 1).toUpperCase()}</span>}
            {author}
          </Link>
        </div>
        {showStatus ? (
          <span className={`tier-list-status tier-list-status-${list.status}`}>{published ? 'Опубликован' : 'Черновик'}</span>
        ) : published && (list.reactionsEnabled || list.comments > 0) ? (
          <span className="tier-list-card-stats">
            {list.reactionsEnabled && <TierLikeButton id={list.id} likes={list.likes} vote={viewer?.votes.get(list.id) ?? 0} signedIn={Boolean(viewer?.id)} own={viewer?.id === list.userId} />}
            {list.commentsEnabled && list.comments > 0 && <Link href={`${href}#tier-discussion`} aria-label={`Комментарии: ${list.comments}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="M20 16a3 3 0 0 1-3 3H9l-5 3V6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v10Z" /></svg>
              {count.format(list.comments)}
            </Link>}
          </span>
        ) : null}
      </header>

      <Link className="tier-list-card-board" href={href} tabIndex={-1} aria-hidden="true">
        {rows.length > 0 ? rows.map((tier) => {
          const items = list.preview.filter((placement) => placement.tier === tier);
          const more = (list.tierCounts[tier] ?? 0) - items.length;
          return (
            <span className="tier-list-card-row" key={tier}>
              <span className="tier-list-card-tier"><span className={`tier-letter tier-letter-${tier.toLowerCase()}`}>{tier}</span></span>
              <span className="tier-list-card-items">
                {items.map((placement) => {
                  const product = productByKey.get(itemKey(placement.brand, placement.flavor));
                  return (
                    <span className="tier-list-card-item" key={itemKey(placement.brand, placement.flavor)}>
                      {product?.imageUrl
                        ? <Image src={product.imageUrl} width={40} height={52} sizes="40px" alt="" />
                        : placement.brand.slice(0, 2).toLocaleUpperCase('ru-RU')}
                    </span>
                  );
                })}
                {more > 0 ? <span className="tier-list-card-item tier-list-card-more">+{more}</span> : null}
              </span>
            </span>
          );
        }) : <span className="tier-list-card-board-empty">Добавьте энергетики</span>}
      </Link>

      <Link className="tier-list-card-open" href={href}>
        {published ? 'Посмотреть тирлист' : 'Продолжить'}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
      </Link>
    </article>
  );
}
