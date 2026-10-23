import { isAssortmentFlavor } from '@canrush/shared';
import { CatalogVolumeTabs } from '@/components/catalog-volume-tabs';
import { CatalogPriceHistory } from '@/components/catalog-price-history';
import type { PriceSeries } from '@/lib/price-history';
import Image from 'next/image';
import Link from '@/components/navigation-progress';
import type { SwipeCounts } from '@/lib/drink-swipes';
import type { CatalogDrink } from '@/lib/catalog-drinks';
import { CatalogDrinkAuthor } from '@/components/catalog-drink-author';
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
  /** Dating in the community: how many swiped the drink right («нравится») and left («пропустить»). */
  swipes?: SwipeCounts;
  /** A drink a member added (catalogDrink) that shops do not have yet: who added it, when, and the volumes they gave. */
  addedBy?: Pick<CatalogDrink, 'author' | 'volumes' | 'createdAt'>;
}

export function CatalogProductDetail({ group, priceHistory=[], ingredients, favorite, authenticated, reviews, summary, userReview, activeTab, swipes, addedBy }: CatalogProductDetailProps) {
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
        {addedBy && <ul className="catalog-added-facts" aria-label="О напитке">
          <li className="catalog-added-badge"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16 21v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM19 8v6M16 11h6" /></svg>От участника</li>
          {addedBy.volumes.map(volume => <li key={volume}>{volumeLabel(volume)}</li>)}
        </ul>}
        {swipes && (swipes.liked > 0 || swipes.skipped > 0) && <section className="catalog-swipe-card" aria-label={`В дейтинге: свайпнули ${swipes.liked}, пропустили ${swipes.skipped}`}>
          <div className="catalog-swipe-head">
            <strong>В дейтинге</strong>
            <Link href="/community?type=dating">Свайпать ↗</Link>
          </div>
          <div className="catalog-swipe-stats">
            <span className="is-liked"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 21s-7.5-4.6-9.6-9.3C.9 8.2 3 4.5 6.6 4.5c2.1 0 3.6 1.2 4.4 2.5.8-1.3 2.3-2.5 4.4-2.5 3.6 0 5.7 3.7 4.2 7.2C19.5 16.4 12 21 12 21Z" /></svg><b>{swipes.liked}</b>Свайпнули</span>
            <span className="is-skipped"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg><b>{swipes.skipped}</b>Пропустили</span>
          </div>
          <span className="catalog-swipe-bar" aria-hidden="true"><span style={{ width: `${Math.round(swipes.liked / (swipes.liked + swipes.skipped) * 100)}%` }} /></span>
        </section>}
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
                              <span className="catalog-store-offer-arrow" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M7 17 17 7M9 7h8v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                              <span className="sr-only">, открыть в магазине в новой вкладке</span>
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
                addedBy ? <div className="catalog-added-empty">
                  <span className="catalog-added-empty-icon" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9 5 3h14l2 6M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0V9Zm2 5v7h14v-7" /></svg></span>
                  <div><strong>Цен пока нет</strong><p>Напиток добавил участник — в магазинах из нашего мониторинга его ещё не нашли. Видели его в продаже? Добавьте магазин, и его увидят все.</p></div>
                  <Link className="community-button community-button-secondary" href="/market/stores/new">Добавить магазин</Link>
                </div> : <p className="catalog-product-note">Пока нет актуальных предложений.</p>
              )}
            </section>

            {/* A member's drink without offers has no history yet; the empty card above already says so. */}
            {!(addedBy && !priceHistory.length) && <CatalogPriceHistory icons={Object.fromEntries([...new Set(priceHistory.flatMap(s=>s.stores.map(store=>store.name)))].map(name=>[name,<RetailerBadge key={name} name={name} decorative/>]))} series={sortedHistory} today={new Date().toISOString().slice(0,10)}/>}

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
        {addedBy && <CatalogDrinkAuthor author={addedBy.author} createdAt={addedBy.createdAt} />}
      </div>
    </article>
  );
}
