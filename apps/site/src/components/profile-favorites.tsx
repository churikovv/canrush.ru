import Image from 'next/image';
import Link from '@/components/navigation-progress';
import { RemoveFavoriteButton } from '@/components/remove-favorite-button';
import type { CatalogGroup } from '@canrush/shared';
import { RetailerBadge } from '@/components/retailer-badge';
import { cheapestVariant } from '@/lib/catalog';
import { catalogGroupSlug, flavorName } from '@/lib/catalog-query';

interface ProfileFavoritesProps {
  groups: CatalogGroup[];
  ownerName: string;
  isOwn: boolean;
  ownerUsername: string;
}

const PRICE_FORMATTER = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });

function retailerNames(group: CatalogGroup): string[] {
  return [...new Set(group.variants.filter(variant => variant.retailer || variant.source !== 'edadeal').map((variant) => variant.retailer ?? variant.source))];
}

function FavoriteCard({ group, eager, isOwn }: { group: CatalogGroup; eager: boolean; isOwn: boolean }) {
  const href = `/catalog/${catalogGroupSlug(group.brand, group.flavor)}`;
  const cheapest = cheapestVariant(group);
  const retailers = retailerNames(group);
  const visibleRetailers = retailers.slice(0, 4);
  const remaining = retailers.length - visibleRetailers.length;

  return (
    <article className="favorite-card">
      <Link className="favorite-card-product" href={href}>
      {group.coverImageUrl ? (
        <div className="favorite-card-image">
          <Image
            src={group.coverImageUrl}
            width={170}
            height={170}
            sizes="(min-width: 960px) 280px, (min-width: 640px) 45vw, 90vw"
            alt={`${group.brand}, ${flavorName(group.flavor)}`}
            loading={eager ? 'eager' : 'lazy'}
          />
        </div>
      ) : (
        <div className="favorite-card-image favorite-card-image-empty" aria-hidden="true" />
      )}

      <div className="favorite-card-brand">{group.brand}</div>
      <h2>{flavorName(group.flavor)}</h2>
      </Link>

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

      <div className="favorite-card-actions">
        <Link className="favorite-card-link" href={href}>Открыть товар</Link>
        {isOwn && <RemoveFavoriteButton brand={group.brand} flavor={group.flavor} />}
      </div>
    </article>
  );
}

export function ProfileFavorites({ groups, ownerName, isOwn, ownerUsername }: ProfileFavoritesProps) {
  return (
    <div className={`favorites-layout${isOwn ? ' ym-hide-content' : ''}`}>
      <Link className="favorites-back community-button community-button-secondary" href={isOwn ? '/profile' : `/profile/${encodeURIComponent(ownerUsername)}`}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m10 5-7 7 7 7M3 12h18" /></svg>
        В профиль
      </Link>
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
            <FavoriteCard key={`${group.brand}:${group.flavor}`} group={group} eager={index === 0} isOwn={isOwn} />
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
