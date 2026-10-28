'use client';
import type { ReactNode } from 'react';

/**
 * Counts taps on the drink's store offers for the business cabinet («Карточки»): a click on a link with
 * `data-retailer` inside sends a beacon to `/api/catalog-events` and the link opens as usual. Nothing is sent about
 * who tapped.
 */
export function CatalogOfferClicks({ brand, flavor, children }: { brand: string; flavor: string; children: ReactNode }) {
  return <div className="catalog-offer-clicks" onClick={event => {
    const link = (event.target as Element).closest<HTMLAnchorElement>('a[data-retailer]');
    const retailer = link?.dataset.retailer;
    if (!retailer) return;
    const body = new Blob([JSON.stringify({ brand, flavor, retailer })], { type: 'application/json' });
    try { if (navigator.sendBeacon?.('/api/catalog-events', body)) return; } catch { /* falls back to fetch */ }
    void fetch('/api/catalog-events', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(() => undefined);
  }}>{children}</div>;
}
