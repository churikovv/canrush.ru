'use client';
import Image from 'next/image';
import type { ReactNode } from 'react';
import { useHistorySheet } from '@/components/history-sheet';
import { RatingStars } from '@/components/rating-stars';

/** The newest review as the card previews it; the date comes formatted, so the server and the browser agree. */
export interface LatestReview { author: string; avatarId: string | null; score: number; date: string; text: string }

function reviewsWord(count: number) {
  const ones = count % 10, tens = count % 100;
  if (ones === 1 && tens !== 11) return 'отзыв';
  if (ones >= 2 && ones <= 4 && (tens < 12 || tens > 14)) return 'отзыва';
  return 'отзывов';
}

/**
 * The drink page's rating card — score, stars, how many reviews and a preview of the newest one, cut with an ellipsis
 * when it does not fit — that opens the reviews as a sheet over the page (the whole card is the target: the head link
 * stretches over it). The sheet lives in the history (`useHistorySheet`), so back closes it; `?tab=reviews` (a
 * notification, a feed link, `#review-<id>`) opens it on arrival. The reviews themselves are server-rendered children.
 */
export function CatalogReviewsSheet({ overall, count, title, initiallyOpen, latest, children }: { overall: number; count: number; title: string; initiallyOpen: boolean; latest?: LatestReview | null; children: ReactNode }) {
  const { dialog, open, dismiss, cancel, backdrop } = useHistorySheet('reviews', 'canrushReviewsSheet', initiallyOpen);

  const hasReviews = count > 0;
  return <>
    <div className="catalog-rating-card">
    <a href="?tab=reviews" className="catalog-rating-card-head" aria-haspopup="dialog" onClick={open}>
      {hasReviews ? <>
        <span className="catalog-rating-card-score">
          <strong>{overall.toFixed(1)}<small>/10</small></strong>
          <RatingStars value={overall} size={16} label={`Общий рейтинг ${overall.toFixed(1)} из 10`} />
        </span>
        <span className="catalog-rating-card-count">{count} {reviewsWord(count)}</span>
      </> : <>
        <span className="catalog-rating-card-score"><strong className="catalog-rating-card-empty">Отзывов пока нет</strong></span>
        <span className="catalog-rating-card-count">Оцените первым — вкус и дизайн</span>
      </>}
      <svg className="catalog-rating-card-arrow" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
    </a>
    {latest && <div className="catalog-rating-latest">
      <span className="catalog-rating-latest-head">
        <span className="catalog-rating-latest-avatar">{latest.avatarId ? <Image src={`/api/profile-images/${latest.avatarId}`} width={32} height={32} unoptimized alt="" /> : <span aria-hidden="true">{latest.author[0]?.toUpperCase()}</span>}</span>
        <b>{latest.author}</b>
        <span className="catalog-rating-latest-score">{latest.score.toFixed(1)}</span>
        <small>{latest.date}</small>
      </span>
      <p>{latest.text}</p>
    </div>}
    </div>

    <dialog ref={dialog} className="catalog-reviews-sheet" aria-labelledby="catalog-reviews-title" onCancel={cancel} onClick={backdrop}>
      <header className="catalog-reviews-sheet-head">
        <button type="button" className="catalog-reviews-sheet-back" aria-label="Назад к напитку" onClick={dismiss}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <div>
          <h2 id="catalog-reviews-title">Отзывы{hasReviews ? ` · ${count}` : ''}</h2>
          <p>{title}</p>
        </div>
      </header>
      <div className="catalog-reviews-sheet-body">{children}</div>
    </dialog>
  </>;
}
