import { profileTagKey } from '@/lib/profile-achievements';
import { ReviewDiscussion } from '@/components/review-discussion';
import { ProfileExperience } from '@/components/profile-experience';
import Image from 'next/image';
import Link from '@/components/navigation-progress';
import { ReviewPhotoGallery } from '@/components/review-photo-gallery';
import { ReviewEditShortcut } from '@/components/review-edit-shortcut';
import type { ReviewData } from '@/lib/reviews';

const CRITERIA = [
  { key: 'design', label: 'Дизайн' },
  { key: 'taste', label: 'Вкус' },
] as const;

const reviewDate = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Moscow' });

function Star({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.3l6.5-.9z" strokeLinejoin="round" /></svg>;
}

function authorDisplay(review: ReviewData): string {
  const name = review.author.name.trim();
  return name && !name.includes('@') ? name : review.author.username;
}

/** A published review: author column (avatar, name, badges) beside the scores, text, photos and discussion. Wall record pieces are reused. */
export function CatalogReviewItem({ review, own = false }: { review: ReviewData; own?: boolean }) {
  const profileHref = `/profile/${review.author.username}`;
  const overall = (review.design + review.taste) / 2;
  const createdAt = new Date(review.createdAt);
  const avatar = review.author.avatarId
    ? <Image src={`/api/profile-images/${review.author.avatarId}`} width={40} height={40} unoptimized alt="" />
    : authorDisplay(review).charAt(0).toLocaleUpperCase('ru-RU');

  return (
    <article className="review-item" id={`review-${review.id}`}>
      <header className="review-item-author">
        <Link className="wall-avatar review-item-avatar" href={profileHref} tabIndex={-1} aria-hidden="true">{avatar}</Link>
        <div className="review-item-who">
          <Link className="wall-post-author" href={profileHref}>{authorDisplay(review)}</Link>
          <span className="review-item-handle">@{review.author.username}</span>
        </div>
        <div className="review-item-badges">
          {review.author.tag && <span className="profile-tag" data-tag={profileTagKey(review.author.tag)}>{review.author.tag}</span>}
          <ProfileExperience username={review.author.username} initial={{ xp: review.author.xp ?? 0, rank: null }} />
        </div>
      </header>
      {own && <div className="wall-post-actions review-item-actions"><ReviewEditShortcut /></div>}

      <div className="review-item-body">
        <div className="review-item-top">
          <span className="review-item-overall" role="img" aria-label={`Общая оценка ${overall.toFixed(1)} из 10`}><Star size={14} /><strong>{overall.toFixed(1)}</strong></span>
          <dl className="review-item-ratings">
            {CRITERIA.map(({ key, label }) => <div key={key}><dt>{label}</dt><dd>{review[key].toFixed(1)}</dd></div>)}
          </dl>
          <time className="review-item-date" dateTime={createdAt.toISOString()}>{reviewDate.format(createdAt)}</time>
        </div>

        <p className="review-item-text">{review.text}</p>
        <ReviewPhotoGallery photos={review.photos} />

        <ReviewDiscussion reviewId={review.id} initial={review.interaction} telegramChannel={review.author.telegramChannel} />
      </div>
    </article>
  );
}
