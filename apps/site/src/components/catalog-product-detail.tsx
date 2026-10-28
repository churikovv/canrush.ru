import { isAssortmentFlavor } from '@canrush/shared';
import { CatalogVolumeTabs } from '@/components/catalog-volume-tabs';
import { CatalogPriceHistory } from '@/components/catalog-price-history';
import { CatalogOfferClicks } from '@/components/catalog-offer-clicks';
import type { PriceSeries } from '@/lib/price-history';
import { CoverImage } from '@/components/cover-image';
import Link from '@/components/navigation-progress';
import type { DrinkSummary } from '@/lib/review-digest';
import type { DrinkRadar } from '@/lib/score-profile';
import type { SwipeCounts } from '@/lib/drink-swipes';
import type { CatalogDrink } from '@/lib/catalog-drinks';
import { CatalogDrinkAuthor } from '@/components/catalog-drink-author';
import type { CatalogGroup, PublishedIngredients } from '@canrush/shared';
import { CatalogProductIngredients } from '@/components/catalog-product-ingredients';
import { CatalogFavoriteButton } from '@/components/catalog-favorite-button';
import { CatalogProductReviews } from '@/components/catalog-product-reviews';
import { CatalogReviewsSheet } from '@/components/catalog-reviews-sheet';
import { RetailerBadge } from '@/components/retailer-badge';
import { catalogOffersByVolume, catalogRetailerName, flavorName } from '@/lib/catalog-query';
import type { ReviewData, ReviewSummary } from '@/lib/reviews';
import type { DrinkStore } from '@/lib/brand-drink-stores';
import type { DrinkPrice } from '@/lib/brand-drink-prices';
import { sameVolume } from '@/lib/brand-drink-price-fields';
import { mapSearchUrl } from '@/lib/brand-drink-store-fields';

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
  /** `?tab=reviews` (a notification, a feed link): the reviews sheet is open on arrival. */
  reviewsOpen: boolean;
  /** Dating in the community: how many swiped the drink right («нравится») and left («пропустить»). */
  swipes?: SwipeCounts;
  /** A drink a member added (catalogDrink) that shops do not have yet: who added it, when, and the volumes they gave. */
  addedBy?: Pick<CatalogDrink, 'author' | 'volumes' | 'createdAt' | 'business'>;
  /** The full name a member gave the drink («Monster Ultra Paradise»), shown under the flavour. */
  fullName?: string;
  /** The review summary written by the model (nightly or from a company cabinet): its praise and complaints sit under the rating card, unsigned. */
  reviewDigest?: DrinkSummary | null;
  /** The reviews tab: the rating card's radar against the catalog average. */
  radar?: { drink: DrinkRadar; catalog: DrinkRadar; country: string | null } | null;
  /** The brand's own data (an approved edit from its cabinet): the «data confirmed by the brand» mark and its description. */
  brand?: { business: string | null; description: string | null } | null;
  /** «Где купить» from the brand's cabinet: chains, stores of the CanRush map and the brand's own stores. */
  brandStores?: DrinkStore[];
  /** The brand's recommended ceiling «до N ₽» per can volume, from its cabinet. */
  ceilings?: DrinkPrice[];
}


export function CatalogProductDetail({ group, priceHistory=[], ingredients, favorite, authenticated, reviews, summary, userReview, reviewsOpen, swipes, addedBy, fullName, reviewDigest, radar, brand, brandStores = [], ceilings = [] }: CatalogProductDetailProps) {
  const volumeGroups = catalogOffersByVolume(group).sort((a, b) => (b.volumeMl ?? -1) - (a.volumeMl ?? -1));
  const sortedHistory = [...priceHistory].sort((a, b) => (b.volume ?? -1) - (a.volume ?? -1));

  return (
    <article className="catalog-product-detail">
      <div className="catalog-product-visual">
        {group.coverImageUrl ? (
          <CoverImage
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
        {fullName && <p className="catalog-full-name">{fullName}</p>}
        {brand && <p className="catalog-brand-verified"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6L12 3Z" /><path d="m8.5 12 2.5 2.5 4.5-5" /></svg>Данные подтверждены брендом{brand.business ? ` «${brand.business}»` : ''}</p>}
        {brand?.description && <section className="catalog-brand-description" aria-label="От бренда"><h2>От бренда</h2><p>{brand.description}</p></section>}
        {addedBy && <ul className="catalog-added-facts" aria-label="О напитке">
          {/* A company's own drink is the brand's product, not a member's find: the brand's mark, no author card below. */}
          {addedBy.business
            ? <li className="catalog-added-badge"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6L12 3Z" /><path d="m8.5 12 2.5 2.5 4.5-5" /></svg>От бренда «{addedBy.business}»</li>
            : <li className="catalog-added-badge"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16 21v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM19 8v6M16 11h6" /></svg>От участника</li>}
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

        <div className="catalog-product-tab-panel">
            <CatalogReviewsSheet overall={summary.count > 0 ? summary.overall : 0} count={summary.count} title={`${group.brand} · ${flavorName(group.flavor)}`} initiallyOpen={reviewsOpen}
              highlights={reviewDigest && summary.count > 0 ? { praise: reviewDigest.body.praise, complaints: reviewDigest.body.complaints } : null}>
              <CatalogProductReviews
                brand={group.brand}
                flavor={group.flavor}
                reviews={reviews}
                summary={summary}
                userReview={userReview}
                authenticated={authenticated}
                radar={radar}
              />
            </CatalogReviewsSheet>
            <section className="catalog-product-section" aria-label="Цены в магазинах">
              {volumeGroups.length > 0 ? (
                <CatalogOfferClicks brand={group.brand} flavor={group.flavor}>
                <CatalogVolumeTabs labels={volumeGroups.map(({volumeMl})=>volumeLabel(volumeMl) ?? "Объём не указан")}>
                  {volumeGroups.map(({ volumeMl, offers }) => (
                    <section className="catalog-store-volume" key={volumeMl ?? 'unknown'} aria-labelledby={`volume-${volumeMl ?? 'unknown'}`}>
                      <h3 id={`volume-${volumeMl ?? 'unknown'}`}>{volumeLabel(volumeMl) ?? 'Объём не указан'}</h3>
                      {(() => { const ceiling = volumeMl ? ceilings.find(item => sameVolume(volumeMl, item.volumeMl)) : undefined; return ceiling && <p className="catalog-price-ceiling">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6L12 3Z" /><path d="m8.5 12 2.5 2.5 4.5-5" /></svg>
                        <span>Бренд «{ceiling.business}» рекомендует: <b>до {PRICE_FORMATTER.format(ceiling.maxPrice)} ₽</b></span>
                      </p>; })()}
                      <div className="catalog-store-list">
                        {offers.map((offer) => {
                          const name = catalogRetailerName(offer);
                          const hasLink = offer.source !== 'edadeal';
                          const ceiling = volumeMl ? ceilings.find(item => sameVolume(volumeMl, item.volumeMl)) : undefined;
                          const over = Boolean(ceiling && offer.price > ceiling.maxPrice);
                          const className = `${hasLink ? 'catalog-store-offer' : 'catalog-store-offer catalog-store-offer-static'}${over ? ' is-over-ceiling' : ''}`;
                          const content = (
                            <>
                              <RetailerBadge name={name} size="large" decorative />
                              <span>
                                <strong>{PRICE_FORMATTER.format(offer.price)} ₽</strong>
                                <small>{name}{over && <em> · дороже рекомендованной</em>}</small>
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
                              data-retailer={name}
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
                </CatalogOfferClicks>
              ) : (
                addedBy ? <div className="catalog-added-empty">
                  <span className="catalog-added-empty-icon" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9 5 3h14l2 6M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0V9Zm2 5v7h14v-7" /></svg></span>
                  <div><strong>Цен пока нет</strong><p>{addedBy.business
                    ? `Напиток добавил бренд «${addedBy.business}» — в магазинах из нашего мониторинга его ещё не нашли.${brandStores.length ? ' Где он продаётся, бренд указал ниже.' : ''}`
                    : 'Напиток добавил участник — в магазинах из нашего мониторинга его ещё не нашли.'} Видели его в продаже? Добавьте магазин, и его увидят все.</p></div>
                  <Link className="community-button community-button-secondary" href="/market/stores/new">Добавить магазин</Link>
                </div> : <p className="catalog-product-note">Пока нет актуальных предложений.</p>
              )}
            </section>

            {brandStores.length > 0 && <BrandStores stores={brandStores} />}

            {/* A member's drink without offers has no history yet; the empty card above already says so. */}
            {!(addedBy && !priceHistory.length) && <CatalogPriceHistory icons={Object.fromEntries([...new Set(priceHistory.flatMap(s=>s.stores.map(store=>store.name)))].map(name=>[name,<RetailerBadge key={name} name={name} decorative/>]))} series={sortedHistory} today={new Date().toISOString().slice(0,10)}/>}

            <CatalogProductIngredients data={ingredients} />
        </div>
        {addedBy && !addedBy.business && <CatalogDrinkAuthor author={addedBy.author} createdAt={addedBy.createdAt} />}
      </div>
    </article>
  );
}

const STORE_ICON = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 9 5 3h14l2 6M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0V9Zm2 5v7h14v-7" /></svg>;

/**
 * «Где купить» from the brand, under the prices: chains (their badge), stores of the CanRush map (their page) and the
 * brand's own stores (its link, or the address on the map). The brand's word, not our monitoring — so no prices, and
 * outside links carry `nofollow`.
 */
function BrandStores({ stores }: { stores: DrinkStore[] }) {
  const companies = [...new Set(stores.map(store => store.business))];
  return <section className="catalog-product-section catalog-brand-stores" aria-labelledby="brand-stores-title">
    <div className="catalog-brand-stores-head"><h2 id="brand-stores-title">Где купить</h2><span>по данным {companies.length === 1 ? `бренда «${companies[0]}»` : 'брендов'}</span></div>
    <div className="catalog-store-list">{stores.map(store => {
      const where = [store.city, store.address].filter(Boolean).join(', ');
      if (store.kind === 'retailer') return <div key={store.id} className="catalog-store-offer catalog-store-offer-static">
        <RetailerBadge name={store.name} size="large" decorative /><span><strong>{store.name}</strong><small>Сеть магазинов</small></span>
      </div>;
      const body = <><span className="catalog-brand-store-icon">{STORE_ICON}</span><span><strong>{store.name}</strong><small>{where || (store.url ? new URL(store.url).hostname : '')}</small></span></>;
      if (store.kind === 'store') return <Link key={store.id} className="catalog-store-offer" href={`/market/stores/${store.storeId}`}>{body}</Link>;
      const href = store.url ?? mapSearchUrl(store.address!, store.city);
      return <a key={store.id} className="catalog-store-offer" href={href} target="_blank" rel="nofollow noopener noreferrer">{body}</a>;
    })}</div>
  </section>;
}
