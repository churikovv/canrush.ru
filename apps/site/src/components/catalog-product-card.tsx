import Image from 'next/image';
import Link from 'next/link';
import { isResolvedFlavor, type CatalogGroup } from '@canrush/shared';
import { RetailerBadge } from '@/components/retailer-badge';
import { cheapestVariant } from '@/lib/catalog';
import { catalogGroupSlug, flavorName } from '@/lib/catalog-query';
import type { ReviewSummary } from '@/lib/reviews';

const PRICE_FORMATTER = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });

function volumeLabel(volume: number | undefined): string | undefined {
  if (volume === undefined) return undefined;
  return volume >= 1000 && volume % 1000 === 0 ? `${volume / 1000} л` : `${volume} мл`;
}

function retailers(group: CatalogGroup): string[] {
  return [...new Set(group.variants.map((variant) => variant.retailer ?? variant.source))];
}

interface CatalogProductCardProps {
  group: CatalogGroup;
  eager: boolean;
  summary?: ReviewSummary;
}

export function CatalogProductCard({ group, eager, summary }: CatalogProductCardProps) {
  const cheapest = cheapestVariant(group);
  const cheapestVolume = volumeLabel(cheapest?.volumeMl);
  const retailerNames = retailers(group);
  const visibleRetailers = retailerNames.slice(0, 4);
  const remaining = retailerNames.length - visibleRetailers.length;
  const href = `/catalog/${catalogGroupSlug(group.brand, group.flavor)}`;
  const ratingValue = isResolvedFlavor(group.flavor) && summary && summary.count > 0 ? summary.overall : 0;

  return (
    <article className="catalog-card">
      <Link className="catalog-card-link" href={href} aria-label={`${group.brand}, ${flavorName(group.flavor)}`}>
        <div className="catalog-card-image">
          {group.coverImageUrl ? (
            <Image
              src={group.coverImageUrl}
              width={170}
              height={170}
              sizes="(max-width: 639px) calc((100vw - 38px) / 2), 206px"
              alt={`${group.brand}, ${flavorName(group.flavor)}`}
              loading={eager ? 'eager' : 'lazy'}
            />
          ) : (
            <span aria-hidden="true" />
          )}
        </div>

        <div className="catalog-card-meta">
          <div
            className="catalog-card-rating"
            aria-label={isResolvedFlavor(group.flavor) ? `Рейтинг ${ratingValue.toFixed(1)} из 10` : 'Вкус не подтверждён, рейтинг недоступен'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.3l6.5-.9z" strokeLinejoin="round" />
            </svg>
            <strong>{isResolvedFlavor(group.flavor) ? ratingValue.toFixed(1) : '—'}</strong>
          </div>
          <span>{group.brand}</span>
        </div>

        <h2>{flavorName(group.flavor)}</h2>

        {cheapest ? (
          <div className="catalog-card-price">
            <strong>{PRICE_FORMATTER.format(cheapest.price)} ₽</strong>
            {cheapest.oldPrice && cheapest.oldPrice > cheapest.price ? (
              <del>{PRICE_FORMATTER.format(cheapest.oldPrice)} ₽</del>
            ) : null}
            {cheapestVolume ? <span className="catalog-card-volume">{cheapestVolume}</span> : null}
          </div>
        ) : <p className="catalog-city-caption">Нет предложений в городе</p>}

        <div className="catalog-card-retailers" aria-hidden="true">
          {visibleRetailers.map((retailer) => (
            <RetailerBadge key={retailer} name={retailer} decorative />
          ))}
          {remaining > 0 ? <span className="retailer-badge retailer-badge-small">+{remaining}</span> : null}
        </div>
      </Link>
    </article>
  );
}
