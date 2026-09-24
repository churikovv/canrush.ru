import Link from 'next/link';
import { ReviewPhotoGallery } from '@/components/review-photo-gallery';
import type { ReviewData } from '@/lib/reviews';

const CRITERIA = [
  { key: 'design', label: 'Дизайн' },
  { key: 'taste', label: 'Вкус' },
  { key: 'composition', label: 'Состав' },
] as const;

function formatDate(value: Date | string): string {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value));
}

function authorDisplay(review: ReviewData): string {
  const name = review.author.name.trim();
  return name && !name.includes('@') ? name : review.author.username;
}

function authorInitial(review: ReviewData): string {
  return authorDisplay(review).charAt(0).toLocaleUpperCase('ru-RU');
}

export function CatalogReviewItem({ review }: { review: ReviewData }) {
  const telegramHref = review.author.telegramChannel
    ? `https://t.me/${review.author.telegramChannel}`
    : undefined;
  const profileHref = `/profile/${review.author.username}`;
  const overall = (review.design + review.taste + review.composition) / 3;
  const createdAt = new Date(review.createdAt);

  return (
    <article className="review-item">
      <header className="review-item-header">
        <div className="review-item-identity">
          <span className="review-item-avatar" aria-hidden="true">
            {authorInitial(review)}
          </span>
          <div className="review-item-author">
            <Link className="review-item-name" href={profileHref}>
              {authorDisplay(review)}
            </Link>
            <div className="review-item-meta">
              <span>@{review.author.username}</span>
              <span aria-hidden="true">·</span>
              <time dateTime={createdAt.toISOString()}>{formatDate(createdAt)}</time>
            </div>
          </div>
        </div>

        <div className="review-item-overall" role="img" aria-label={`Общая оценка ${overall.toFixed(1)} из 5`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.3l6.5-.9z" strokeLinejoin="round" />
          </svg>
          <strong>{overall.toFixed(1)}</strong>
        </div>
      </header>

      <dl className="review-item-ratings">
        {CRITERIA.map(({ key, label }) => (
          <div key={key}>
            <dt>{label}</dt>
            <dd>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.3l6.5-.9z" strokeLinejoin="round" />
              </svg>
              {review[key].toFixed(1)}
            </dd>
          </div>
        ))}
      </dl>

      <p className="review-item-text">{review.text}</p>
      <ReviewPhotoGallery photos={review.photos} />

      {telegramHref ? (
        <footer className="review-item-footer">
          <span>Канал автора</span>
          <Link
            className="review-item-channel"
            href={telegramHref}
            target="_blank"
            rel="noreferrer sponsored"
            aria-label={`Открыть Telegram-канал ${review.author.telegramChannel}`}
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71l-4.14-3.05-1.99 1.94c-.23.23-.42.42-.83.42z" />
            </svg>
            <span>@{review.author.telegramChannel}</span>
          </Link>
        </footer>
      ) : null}
    </article>
  );
}
