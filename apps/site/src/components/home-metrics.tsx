import Image from 'next/image';
import Link from '@/components/navigation-progress';
import type { HomeMetrics as Metrics } from '@/lib/home-metrics';

const count = new Intl.NumberFormat('ru-RU');

function plural(value: number, one: string, few: string, many: string) {
  const tens = value % 100, ones = value % 10;
  if (tens >= 11 && tens <= 14) return many;
  return ones === 1 ? one : ones >= 2 && ones <= 4 ? few : many;
}

// Brand stickers from the achievements, one per tile, standing in the corner like a mascot.
const ART = { reviews: 'three', tierlists: 'top', stores: 'shopper', drinks: 'burner' } as const;

/** Live totals at the top of the home page: big colour cards with the number and a brand sticker; each opens what it counts. Zero tiles are left out. */
export function HomeMetrics({ data }: { data: Metrics }) {
  const metrics = [
    { key: 'reviews', value: data.reviews, label: plural(data.reviews, 'оценка', 'оценки', 'оценок'), href: '/catalog?sort=rating' },
    { key: 'tierlists', value: data.tierLists, label: plural(data.tierLists, 'тирлист', 'тирлиста', 'тирлистов'), href: '/community' },
    { key: 'stores', value: data.stores, label: `${plural(data.stores, 'магазин', 'магазина', 'магазинов')} с ценами`, href: '/prices' },
    { key: 'drinks', value: data.drinks, label: plural(data.drinks, 'напиток', 'напитка', 'напитков'), href: '/catalog' },
  ] as const;
  const shown = metrics.filter(metric => metric.value > 0);
  if (!shown.length) return null;
  return <ul className="home-metrics" aria-label="CanRush в цифрах">{shown.map(metric => <li key={metric.key}><Link href={metric.href} data-metric={metric.key}>
    <strong>{count.format(metric.value)}</strong>
    <span>{metric.label}</span>
    <Image className="home-metric-art" src={`/brand/achievements/${ART[metric.key]}.png`} width={220} height={220} sizes="(max-width: 639px) 40vw, 200px" alt="" />
  </Link></li>)}</ul>;
}
