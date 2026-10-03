import { isResolvedFlavor } from '@canrush/shared';
import { CatalogReviewForm } from '@/components/catalog-review-form';
import { CatalogReviewItem } from '@/components/catalog-review-item';
import { RatingStars } from '@/components/rating-stars';
import type { ReviewData, ReviewSummary } from '@/lib/reviews';

interface CatalogProductReviewsProps {
  brand: string;
  flavor: string;
  reviews: ReviewData[];
  summary: ReviewSummary;
  userReview: ReviewData | null;
  authenticated: boolean;
}

const CRITERIA: Array<{ key: keyof Pick<ReviewSummary, 'design' | 'taste'>; label: string }> = [
  { key: 'design', label: 'Дизайн' },
  { key: 'taste', label: 'Вкус' },
];

function pluralReviews(count: number): string {
  const remainder10 = count % 10;
  const remainder100 = count % 100;
  if (remainder10 === 1 && remainder100 !== 11) return 'отзыв';
  if (remainder10 >= 2 && remainder10 <= 4 && (remainder100 < 12 || remainder100 > 14)) return 'отзыва';
  return 'отзывов';
}

function pluralRatings(count: number): string {
  const remainder10 = count % 10;
  const remainder100 = count % 100;
  if (remainder10 === 1 && remainder100 !== 11) return 'оценка';
  if (remainder10 >= 2 && remainder10 <= 4 && (remainder100 < 12 || remainder100 > 14)) return 'оценки';
  return 'оценок';
}

export function CatalogProductReviews({
  brand,
  flavor,
  reviews,
  summary,
  userReview,
  authenticated,
}: CatalogProductReviewsProps) {
  if (!isResolvedFlavor(flavor)) return <section className="catalog-product-section catalog-reviews">
    <p>Вкус этого предложения не подтверждён. Общий рейтинг и новые отзывы недоступны, чтобы не смешивать разные напитки.</p>
    {flavor === 'unknown' && <><p>Отзывы ниже относятся к старой смешанной карточке. Они не перенесены на конкретные вкусы.</p>{reviews.map(review => <CatalogReviewItem key={review.id} review={review} />)}</>}
  </section>;
  const hasReviews = summary.count > 0;
  const overall = hasReviews ? summary.overall : 0;

  return (
    <section className="catalog-product-section catalog-reviews" aria-labelledby="tab-reviews">
      <div className="review-overview">
        <div className="review-summary" aria-labelledby="review-summary-title">
          <div className="review-summary-overall">
            <span className="review-summary-label" id="review-summary-title">
              Общий рейтинг
            </span>
            <div className="review-summary-score">
              <strong>{overall.toFixed(1)}</strong>
              <span>из 10</span>
            </div>
            <RatingStars value={overall} size={14} label="Общий рейтинг" />
            <span className="review-summary-count">
              {summary.count} {pluralRatings(summary.count)}
            </span>
          </div>

          <dl className="review-summary-criteria">
            {CRITERIA.map(({ key, label }) => {
              const value = hasReviews ? summary[key] : 0;
              return (
                <div key={key} className="review-summary-criterion">
                  <dt>{label}</dt>
                  <dd>
                    <span className="review-summary-bar" aria-hidden="true">
                      <span style={{ width: `${(value / 10) * 100}%` }} />
                    </span>
                    <strong>{value.toFixed(1)}</strong>
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>

        <div className="review-form-wrapper">
          <div className="review-form-heading">
            <h2>{userReview ? 'Ваш отзыв' : 'Оценить напиток'}</h2>
            <p>Оцените дизайн и вкус по шкале от 1 до 10 и коротко поделитесь впечатлением.</p>
          </div>
          <CatalogReviewForm brand={brand} flavor={flavor} existing={userReview} authenticated={authenticated} />
        </div>
      </div>

      <section className="review-feed" aria-labelledby="review-feed-title">
        <div className="review-feed-heading">
          <h2 id="review-feed-title">Отзывы пользователей</h2>
          <span>{reviews.length > 0 ? `${reviews.length} ${pluralReviews(reviews.length)}` : 'Пока пусто'}</span>
        </div>

        {reviews.length > 0 ? (
          <div className="review-list">
            {reviews.map((review) => (
              <CatalogReviewItem key={review.id} review={review} />
            ))}
          </div>
        ) : (
          <div className="review-empty">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.3l6.5-.9z" strokeLinejoin="round" />
            </svg>
            <div>
              <strong>Здесь ещё нет отзывов</strong>
              <p>Расскажите, каким оказался этот вкус.</p>
            </div>
          </div>
        )}
      </section>
    </section>
  );
}
