import Image from 'next/image';
import type { CatalogGroup } from '@canrush/shared';
import { CatalogFavoriteButton } from '@/components/catalog-favorite-button';
import { CatalogProductReviews } from '@/components/catalog-product-reviews';
import { CatalogProductTabs, type ProductTab } from '@/components/catalog-product-tabs';
import { RetailerBadge } from '@/components/retailer-badge';
import { catalogOffers, catalogRetailerName, flavorName } from '@/lib/catalog-query';
import type { ReviewData, ReviewSummary } from '@/lib/reviews';

const PRICE_FORMATTER = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });

function volumeLabel(volume: number | undefined): string | undefined {
  if (volume === undefined) return undefined;
  return volume >= 1000 && volume % 1000 === 0 ? `${volume / 1000} л` : `${volume} мл`;
}

interface CatalogProductDetailProps {
  group: CatalogGroup;
  favorite: boolean;
  authenticated: boolean;
  reviews: ReviewData[];
  summary: ReviewSummary;
  userReview: ReviewData | null;
  activeTab: ProductTab;
}

export function CatalogProductDetail({ group, favorite, authenticated, reviews, summary, userReview, activeTab }: CatalogProductDetailProps) {
  const offers = catalogOffers(group);

  return (
    <article className="catalog-product-detail">
      <div className="catalog-product-visual">
        {group.coverImageUrl ? (
          <Image
            src={group.coverImageUrl}
            width={278}
            height={278}
            sizes="(max-width: 639px) 278px, 360px"
            alt={`${group.brand}, ${flavorName(group.flavor)}`}
            priority
          />
        ) : (
          <span aria-hidden="true" />
        )}
      </div>

      <div className="catalog-product-information">
        <div className="catalog-product-heading-row">
          <span className="catalog-product-brand">{group.brand}</span>
          <CatalogFavoriteButton
            brand={group.brand}
            flavor={group.flavor}
            favorite={favorite}
            authenticated={authenticated}
          />
        </div>

        <h1>{flavorName(group.flavor)}</h1>

        <CatalogProductTabs active={activeTab} reviewCount={summary.count} />

        {activeTab === 'prices' ? (
          <div id="tab-panel-prices" role="tabpanel" aria-labelledby="tab-prices" className="catalog-product-tab-panel">
            <section className="catalog-product-section" aria-labelledby="store-prices-title">
              <h2 id="store-prices-title">Цены в магазинах</h2>
              {offers.length > 0 ? (
                <div className="catalog-store-list">
                  {offers.map((offer) => {
                    const name = catalogRetailerName(offer);
                    const volume = volumeLabel(offer.volumeMl);
                    const hasLink = offer.source !== 'edadeal';
                    const className = hasLink ? 'catalog-store-offer' : 'catalog-store-offer catalog-store-offer-static';
                    const content = (
                      <>
                        <RetailerBadge name={name} size="large" decorative />
                        <span>
                          <strong>{PRICE_FORMATTER.format(offer.price)} ₽</strong>
                          <small>{volume ? `${name} · ${volume}` : name}</small>
                        </span>
                        {offer.oldPrice && offer.oldPrice > offer.price ? (
                          <del>{PRICE_FORMATTER.format(offer.oldPrice)} ₽</del>
                        ) : null}
                      </>
                    );
                    return hasLink ? (
                      <a
                        className={className}
                        href={offer.url}
                        target="_blank"
                        rel="noreferrer"
                        key={`${name}:${offer.volumeMl ?? 'unknown'}:${offer.url}`}
                      >
                        {content}
                      </a>
                    ) : (
                      <div className={className} key={`${name}:${offer.volumeMl ?? 'unknown'}:${offer.url}`}>
                        {content}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="catalog-product-note">Пока нет актуальных предложений.</p>
              )}
            </section>

            <section className="catalog-product-section" aria-labelledby="composition-title">
              <h2 id="composition-title">Состав и пищевая ценность</h2>
              <div className="catalog-product-note-card">
                Эти данные пока не указаны магазинами. Мы покажем их, когда источник начнёт передавать состав.
              </div>
            </section>
          </div>
        ) : (
          <div id="tab-panel-reviews" role="tabpanel" aria-labelledby="tab-reviews" className="catalog-product-tab-panel">
            <CatalogProductReviews
              brand={group.brand}
              flavor={group.flavor}
              reviews={reviews}
              summary={summary}
              userReview={userReview}
              authenticated={authenticated}
            />
          </div>
        )}
      </div>
    </article>
  );
}
