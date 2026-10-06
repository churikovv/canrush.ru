import { ReviewDiscussion } from '@/components/review-discussion';
import { ProfileExperience } from '@/components/profile-experience';
import Image from 'next/image';
import Link from '@/components/navigation-progress';
import { ReviewPhotoGallery } from '@/components/review-photo-gallery';
import type { ReviewData } from '@/lib/reviews';

const CRITERIA = [
  { key: 'design', label: 'Дизайн' },
  { key: 'taste', label: 'Вкус' },
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
  const profileHref = `/profile/${review.author.username}`;
  const overall = (review.design + review.taste) / 2;
  const createdAt = new Date(review.createdAt);

  return (
    <article className="review-item" id={`review-${review.id}`}>
      <header className="review-item-header">
        <div className="review-item-identity">
          <span className="review-item-avatar" aria-hidden="true">
            {review.author.avatarId ? <Image src={`/api/profile-images/${review.author.avatarId}`} width={40} height={40} unoptimized alt="" /> : authorInitial(review)}
          </span>
          <div className="review-item-author">
            <Link className="review-item-name" href={profileHref}>
              {authorDisplay(review)}
            </Link>
            <div className="review-item-meta">
              <span>@{review.author.username}</span><ProfileExperience username={review.author.username} initial={{ xp: review.author.xp ?? 0, rank: null }} />
              {review.author.tag && <span className="profile-tag review-author-tag">{review.author.tag}</span>}
              <span aria-hidden="true">·</span>
              <time dateTime={createdAt.toISOString()}>{formatDate(createdAt)}</time>
            </div>
          </div>
        </div>

        <div className="review-item-overall" role="img" aria-label={`Общая оценка ${overall.toFixed(1)} из 10`}>
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

      <ReviewDiscussion reviewId={review.id} initial={review.interaction} telegramChannel={review.author.telegramChannel} />
    </article>
  );
}
