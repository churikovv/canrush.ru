import Image from 'next/image';
import { ProfileBackButton } from '@/components/profile-back-button';
import { ProfileReviewDeleteButton } from '@/components/profile-review-delete-button';
import Link from '@/components/navigation-progress';
import { CatalogReviewItem } from '@/components/catalog-review-item';
import { catalogGroupSlug, flavorName } from '@/lib/catalog-query';
import type { ReviewData } from '@/lib/reviews';

interface ProfileReviewsProps {
  reviews: ReviewData[];
  username: string;
  ownerName: string;
  count: number;
  page: number;
  pages: number;
  isOwn: boolean;
  images: Record<string, string>;
}

export function ProfileReviews({ reviews, username, ownerName, count, page, pages, isOwn, images }: ProfileReviewsProps) {
  const profileHref = `/profile/${username}`;
  return (
    <div className="profile-tierlists-layout profile-reviews-layout">
      <ProfileBackButton href={isOwn ? "/profile" : profileHref} />
      <header className="profile-tierlists-heading">
        <div><p>Автор: {ownerName}</p><h1>Отзывы <span className="profile-reviews-count">{count}</span></h1></div>
      </header>
      {reviews.length ? (
        <div className="profile-reviews-list">
          {reviews.map(review => (
            <section key={review.id} className="profile-review-entry" aria-labelledby={`review-product-${review.id}`}>
              <div className="profile-review-product">
              <Link className="profile-review-product-image" href={`/catalog/${catalogGroupSlug(review.brand, review.flavor)}`} aria-label={`${review.brand} · ${flavorName(review.flavor)}`}>
                {images[review.id] ? <Image src={images[review.id]!} width={88} height={88} alt="" /> : <span>{review.brand.slice(0, 2)}</span>}
              </Link>
              <h2 id={`review-product-${review.id}`}>
                <Link href={`/catalog/${catalogGroupSlug(review.brand, review.flavor)}?tab=reviews`}>
                  {review.brand} · {flavorName(review.flavor)}
                </Link>
              </h2>
              {isOwn && <ProfileReviewDeleteButton brand={review.brand} flavor={review.flavor} />}
              </div>
              <CatalogReviewItem review={review} />
            </section>
          ))}
        </div>
      ) : (
        <div className="profile-tierlists-empty"><strong>Пользователь пока не оставил отзывов</strong><p>Здесь появятся оценки напитков, тексты и фотографии.</p></div>
      )}
      {pages > 1 ? (
        <nav className="profile-reviews-pagination" aria-label="Страницы отзывов">
          {page > 1 ? <Link href={`${profileHref}/reviews?page=${page - 1}`}>← Назад</Link> : <span />}
          <span>Страница {page} из {pages}</span>
          {page < pages ? <Link href={`${profileHref}/reviews?page=${page + 1}`}>Далее →</Link> : <span />}
        </nav>
      ) : null}
    </div>
  );
}
