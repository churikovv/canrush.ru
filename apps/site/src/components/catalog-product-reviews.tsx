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

const CRITERIA: Array<{ key: keyof Pick<ReviewSummary, 'design' | 'taste' | 'composition'>; label: string }> = [
  { key: 'design', label: 'Дизайн' },
  { key: 'taste', label: 'Вкус' },
  { key: 'composition', label: 'Состав' },
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
              <span>из 5</span>
            </div>
            <RatingStars value={overall} size={18} label="Общий рейтинг" />
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
                      <span style={{ width: `${(value / 5) * 100}%` }} />
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
            <h2>{userReview ? 'Изменить свой отзыв' : 'Оценить напиток'}</h2>
            <p>Поставьте три оценки и коротко поделитесь впечатлением.</p>
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
