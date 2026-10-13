import { isAssortmentFlavor } from '@canrush/shared';
import { CatalogVolumeTabs } from '@/components/catalog-volume-tabs';
import { CatalogPriceHistory } from '@/components/catalog-price-history';
import type { PriceSeries } from '@/lib/price-history';
import Image from 'next/image';
import type { CatalogGroup, PublishedIngredients } from '@canrush/shared';
import { CatalogProductIngredients } from '@/components/catalog-product-ingredients';
import { CatalogFavoriteButton } from '@/components/catalog-favorite-button';
import { CatalogProductReviews } from '@/components/catalog-product-reviews';
import { CatalogProductTabs, type ProductTab } from '@/components/catalog-product-tabs';
import { RetailerBadge } from '@/components/retailer-badge';
import { catalogOffersByVolume, catalogRetailerName, flavorName } from '@/lib/catalog-query';
import type { ReviewData, ReviewSummary } from '@/lib/reviews';

const PRICE_FORMATTER = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });

function volumeLabel(volume: number | undefined): string | undefined {
  if (volume === undefined) return undefined;
  return volume >= 1000 && volume % 1000 === 0 ? `${volume / 1000} л` : `${volume} мл`;
}

interface CatalogProductDetailProps {
  group: CatalogGroup;
  priceHistory?: PriceSeries[];
  ingredients: PublishedIngredients | null;
  favorite: boolean;
  authenticated: boolean;
  reviews: ReviewData[];
  summary: ReviewSummary;
  userReview: ReviewData | null;
  activeTab: ProductTab;
}

export function CatalogProductDetail({ group, priceHistory=[], ingredients, favorite, authenticated, reviews, summary, userReview, activeTab }: CatalogProductDetailProps) {
  const volumeGroups = catalogOffersByVolume(group).sort((a, b) => (b.volumeMl ?? -1) - (a.volumeMl ?? -1));
  const sortedHistory = [...priceHistory].sort((a, b) => (b.volume ?? -1) - (a.volume ?? -1));

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
        {isAssortmentFlavor(group.flavor) && <p className="catalog-product-note">В источнике указано несколько напитков в ассортименте. Конкретный вкус и фотография отдельной банки не предоставлены.</p>}

        <CatalogProductTabs active={activeTab} reviewCount={summary.count} />

        {activeTab === 'prices' ? (
          <div id="tab-panel-prices" role="tabpanel" aria-labelledby="tab-prices" className="catalog-product-tab-panel">
            <section className="catalog-product-section" aria-label="Цены в магазинах">
              {volumeGroups.length > 0 ? (
                <CatalogVolumeTabs labels={volumeGroups.map(({volumeMl})=>volumeLabel(volumeMl) ?? "Объём не указан")}>
                  {volumeGroups.map(({ volumeMl, offers }) => (
                    <section className="catalog-store-volume" key={volumeMl ?? 'unknown'} aria-labelledby={`volume-${volumeMl ?? 'unknown'}`}>
                      <h3 id={`volume-${volumeMl ?? 'unknown'}`}>{volumeLabel(volumeMl) ?? 'Объём не указан'}</h3>
                      <div className="catalog-store-list">
                        {offers.map((offer) => {
                          const name = catalogRetailerName(offer);
                          const hasLink = offer.source !== 'edadeal';
                          const className = hasLink ? 'catalog-store-offer' : 'catalog-store-offer catalog-store-offer-static';
                          const content = (
                            <>
                              <RetailerBadge name={name} size="large" decorative />
                              <span>
                                <strong>{PRICE_FORMATTER.format(offer.price)} ₽</strong>
                                <small>{name}</small>
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
                    </section>
                  ))}
                </CatalogVolumeTabs>
              ) : (
                <p className="catalog-product-note">Пока нет актуальных предложений.</p>
              )}
            </section>

            <CatalogPriceHistory icons={Object.fromEntries([...new Set(priceHistory.flatMap(s=>s.stores.map(store=>store.name)))].map(name=>[name,<RetailerBadge key={name} name={name} decorative/>]))} series={sortedHistory} today={new Date().toISOString().slice(0,10)}/>

            <CatalogProductIngredients data={ingredients} />
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
