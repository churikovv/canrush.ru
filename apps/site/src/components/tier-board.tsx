import Image from 'next/image';
import Link from 'next/link';
import { catalogGroupSlug } from '@/lib/catalog-query';
import { TIER_KEYS, type TierListPlacement, type TierListProduct } from '@/lib/tier-list-types';

interface TierBoardProps {
  products: TierListProduct[];
  placements: TierListPlacement[];
  emptyLabel?: string;
}

function itemKey(brand: string, flavor: string): string {
  return `${brand}\u0000${flavor}`;
}

export function TierBoard({ products, placements, emptyLabel = 'Пока пусто' }: TierBoardProps) {
  const productByKey = new Map(products.map((product) => [itemKey(product.brand, product.flavor), product]));

  return (
    <div className="tier-board" aria-label="Тирлист энергетических напитков">
      {TIER_KEYS.map((tier) => {
        const tierItems = placements
          .filter((placement) => placement.tier === tier)
          .sort((left, right) => left.position - right.position);

        return (
          <section className={`tier-board-row tier-board-row-${tier.toLowerCase()}`} key={tier} aria-labelledby={`tier-${tier}`}>
            <h2 className="tier-board-label" id={`tier-${tier}`}>
              <span className={`tier-letter tier-letter-${tier.toLowerCase()}`}>{tier}</span>
            </h2>
            <div className="tier-board-items" role="list">
              {tierItems.length > 0 ? (
                tierItems.map((placement) => {
                  const product = productByKey.get(itemKey(placement.brand, placement.flavor));
                  const label = `${placement.brand}, ${product?.flavorLabel ?? placement.flavor}`;
                  return (
                    <Link
                      className="tier-board-product"
                      href={`/catalog/${catalogGroupSlug(placement.brand, placement.flavor)}`}
                      key={itemKey(placement.brand, placement.flavor)}
                      title={label}
                      aria-label={`Открыть ${label}`}
                      role="listitem"
                    >
                      {product?.imageUrl ? (
                        <Image src={product.imageUrl} width={72} height={72} sizes="72px" alt="" />
                      ) : (
                        <span aria-hidden="true">{placement.brand.slice(0, 2).toLocaleUpperCase('ru-RU')}</span>
                      )}
                      <span className="sr-only">{label}</span>
                    </Link>
                  );
                })
              ) : (
                <p className="tier-board-empty">{emptyLabel}</p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
