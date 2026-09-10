import Image from 'next/image';
import type { CatalogGroup } from '@canrush/shared';
import { RetailerBadge } from '@/components/retailer-badge';
import { cheapestVariant } from '@/lib/catalog';
import { flavorName } from '@/lib/catalog-query';

interface ProfileFavoritesProps {
  groups: CatalogGroup[];
  ownerName: string;
  isOwn: boolean;
}

const PRICE_FORMATTER = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });

function retailerNames(group: CatalogGroup): string[] {
  return [...new Set(group.variants.map((variant) => variant.retailer ?? variant.source))];
}

function FavoriteCard({ group, eager }: { group: CatalogGroup; eager: boolean }) {
  const cheapest = cheapestVariant(group);
  const retailers = retailerNames(group);
  const visibleRetailers = retailers.slice(0, 4);
  const remaining = retailers.length - visibleRetailers.length;

  return (
    <article className="favorite-card">
      {group.coverImageUrl ? (
        <div className="favorite-card-image">
          <Image
            src={group.coverImageUrl}
            width={170}
            height={170}
            sizes="170px"
            alt={`${group.brand}, ${flavorName(group.flavor)}`}
            loading={eager ? 'eager' : 'lazy'}
          />
        </div>
      ) : (
        <div className="favorite-card-image favorite-card-image-empty" aria-hidden="true" />
      )}

      <div className="favorite-card-brand">{group.brand}</div>
      <h2>{flavorName(group.flavor)}</h2>

      {cheapest ? (
        <div className="favorite-card-price">
          <strong>{PRICE_FORMATTER.format(cheapest.price)} ₽</strong>
          {cheapest.oldPrice && cheapest.oldPrice > cheapest.price ? (
            <del>{PRICE_FORMATTER.format(cheapest.oldPrice)} ₽</del>
          ) : null}
        </div>
      ) : null}

      <div className="favorite-card-retailers" aria-label={`Магазины: ${retailers.join(', ')}`}>
        {visibleRetailers.map((retailer) => (
          <RetailerBadge key={retailer} name={retailer} />
        ))}
        {remaining > 0 ? (
          <span className="retailer-badge retailer-badge-small" title={`Ещё ${remaining}`}>
            +{remaining}
          </span>
        ) : null}
      </div>

      {cheapest ? (
        <a className="favorite-card-link" href={cheapest.url} target="_blank" rel="noreferrer">
          Посмотреть цену
        </a>
      ) : null}
    </article>
  );
}

export function ProfileFavorites({ groups, ownerName, isOwn }: ProfileFavoritesProps) {
  return (
    <div className={`favorites-layout${isOwn ? ' ym-hide-content' : ''}`}>
      <div className="favorites-banner" aria-hidden="true">
        <Image src="/brand/favorites-illustration.png" width={206} height={120} alt="" priority />
      </div>

      <header className="favorites-heading">
        <p>Сохраненные</p>
        <h1>Избранное</h1>
      </header>

      {groups.length > 0 ? (
        <div className="favorites-list">
          {groups.map((group, index) => (
            <FavoriteCard key={`${group.brand}:${group.flavor}`} group={group} eager={index === 0} />
          ))}
        </div>
      ) : (
        <div className="favorites-empty">
          <h2>{isOwn ? 'Сохранённых энергетиков пока нет' : `У ${ownerName} пока нет избранного`}</h2>
          <p>
            {isOwn
              ? 'Когда вы добавите напиток в избранное, он появится здесь.'
              : 'Загляните позже, подборка может обновиться.'}
          </p>
        </div>
      )}
    </div>
  );
}
