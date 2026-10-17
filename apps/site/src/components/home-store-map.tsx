'use client';
import { useEffect, useRef, useState } from 'react';
import Link from '@/components/navigation-progress';
import { StoreMap } from './store-map';

export interface HomeStorePoint { id: string; name: string; address: string; station: string | null; latitude: number; longitude: number; drinks: number }

function plural(value: number, one: string, few: string, many: string) {
  const tens = value % 100, ones = value % 10;
  if (tens >= 11 && tens <= 14) return many;
  return ones === 1 ? one : ones >= 2 && ones <= 4 ? few : many;
}

/** Yandex Maps loads only when the section comes near the viewport, so the home page does not pay for it up front. */
export function HomeStoreMap({ apiKey, center, stores }: { apiKey: string; center: [number, number]; stores: HomeStorePoint[] }) {
  const root = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); } }, { rootMargin: '400px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const store = stores.find(item => item.id === selected);
  const points = stores.map(item => ({ id: item.id, latitude: item.latitude, longitude: item.longitude, label: '' }));
  return <div ref={root} className="home-stores-map">
    {visible ? <StoreMap apiKey={apiKey} center={center} points={points} selected={selected} onSelect={setSelected}>
      {store && <div className="home-stores-popup" role="dialog" aria-label={store.name}>
        <button type="button" className="home-stores-close" aria-label="Закрыть" onClick={() => setSelected(null)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg></button>
        <strong>{store.name}</strong>
        <p>{store.address}</p>
        {store.station && <p className="home-stores-station">м. {store.station}</p>}
        {store.drinks > 0 && <p className="home-stores-station">{store.drinks} {plural(store.drinks, 'напиток', 'напитка', 'напитков')} в наличии</p>}
        <Link href={`/market/stores/${store.id}`}>Открыть магазин</Link>
      </div>}
    </StoreMap> : <div className="store-map" aria-hidden="true" />}
  </div>;
}
