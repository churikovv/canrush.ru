'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

export type ProductTab = 'prices' | 'reviews';

interface CatalogProductTabsProps {
  active: ProductTab;
  reviewCount: number;
}

const TABS: Array<{ key: ProductTab; label: string }> = [
  { key: 'prices', label: 'Цены' },
  { key: 'reviews', label: 'Отзывы' },
];

function pluralReviews(count: number): string {
  const r10 = count % 10;
  const r100 = count % 100;
  if (r10 === 1 && r100 !== 11) return 'отзыв';
  if (r10 >= 2 && r10 <= 4 && (r100 < 12 || r100 > 14)) return 'отзыва';
  return 'отзывов';
}

export function CatalogProductTabs({ active, reviewCount }: CatalogProductTabsProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const createTabUrl = useCallback(
    (tab: ProductTab): string => {
      const params = new URLSearchParams(searchParams.toString());
      if (tab === 'prices') {
        params.delete('tab');
      } else {
        params.set('tab', tab);
      }
      const query = params.toString();
      return query ? `${pathname}?${query}` : pathname;
    },
    [pathname, searchParams],
  );

  return (
    <div className="catalog-product-tabs" role="tablist" aria-label="Разделы товара">
      {TABS.map(({ key, label }) => {
        const isActive = key === active;
        const text = key === 'reviews' && reviewCount > 0 ? `${label} · ${reviewCount}` : label;
        return (
          <Link
            key={key}
            id={`tab-${key}`}
            href={createTabUrl(key)}
            role="tab"
            aria-selected={isActive}
            aria-controls={`tab-panel-${key}`}
            className={isActive ? 'catalog-product-tab catalog-product-tab-active' : 'catalog-product-tab'}
            prefetch
          >
            {text}
          </Link>
        );
      })}
    </div>
  );
}

export function pluralizeReviews(count: number): string {
  return pluralReviews(count);
}
