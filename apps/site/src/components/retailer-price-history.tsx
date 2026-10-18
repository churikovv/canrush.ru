'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PricePlot } from '@/components/catalog-price-history';
import { retailerPriceHistoryAction } from '@/app/prices/actions';
import { RetailerBadgeView, type RetailerAsset } from '@/components/retailer-badge-view';
import type { StorePriceSeries } from '@/lib/price-history';

/** Store price trend above the comparison table; follows the table's brand filter. Loads after the page. */
export function RetailerPriceHistory({ brand, icons }: { brand: string; icons: Record<string, ReactNode> }) {
  type History = { stores: StorePriceSeries[]; badges: Record<string, RetailerAsset | null> };
  const cache = useRef(new Map<string, History>());
  const [state, setState] = useState<({ brand: string } & History) | { brand: string; error: true } | null>(null);
  useEffect(() => {
    const cached = cache.current.get(brand);
    let current = true;
    (cached ? Promise.resolve(cached) : retailerPriceHistoryAction(brand)).then(history => {
      cache.current.set(brand, history);
      if (current) setState({ brand, ...history });
    }, () => { if (current) setState({ brand, error: true }); });
    return () => { current = false; };
  }, [brand]);
  const ready = state?.brand === brand ? state : null;
  return <section className="catalog-price-history price-history-compact retailer-price-history" aria-labelledby="retailer-history-title" aria-busy={!ready}>
    <header><h2 id="retailer-history-title">История цен <span>₽ / 100 мл · 90 дней</span></h2></header>
    {!ready ? <p className="price-history-empty">Загружаем историю цен…</p>
      : 'error' in ready ? <p className="price-history-empty">Не удалось загрузить историю цен. Обновите страницу.</p>
      : ready.stores.length ? <PricePlot key={brand} stores={ready.stores} icons={{ ...Object.fromEntries(Object.entries(ready.badges).map(([name, asset]) => [name, <RetailerBadgeView key={name} name={name} asset={asset} decorative />])), ...icons }} unit=" / 100 мл" caption={brand ? `медиана по магазинам · ${brand}` : 'медиана по магазинам'} />
      : <p className="price-history-empty">За последние 90 дней истории цен{brand ? ` по ${brand}` : ''} пока нет.</p>}
  </section>;
}
