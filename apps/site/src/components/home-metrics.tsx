import Link from '@/components/navigation-progress';
import type { HomeMetrics as Metrics } from '@/lib/home-metrics';

const count = new Intl.NumberFormat('ru-RU');

function plural(value: number, one: string, few: string, many: string) {
  const tens = value % 100, ones = value % 10;
  if (tens >= 11 && tens <= 14) return many;
  return ones === 1 ? one : ones >= 2 && ones <= 4 ? few : many;
}

const ICON = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const ICONS = {
  reviews: <svg {...ICON}><path d="m12 3.5 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8L12 3.5Z" /></svg>,
  tierlists: <svg {...ICON}><path d="M4 5h4v4H4zM4 15h4v4H4zM11 7h9M11 17h6M11 12h3M4 10.5h4v3H4z" /></svg>,
  stores: <svg {...ICON}><path d="M4 9.5 5.5 4h13L20 9.5M4 9.5h16M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0M5.5 12v8h13v-8M10 20v-4.5h4V20" /></svg>,
  drinks: <svg {...ICON}><path d="M8 3.5h8M8.5 3.5 7.5 6v13a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5V6l-1-2.5M7.5 9h9M7.5 16h9" /><path d="m12.6 10.5-2 3h3l-2 3" /></svg>,
};

/** Live totals at the top of the home page; each tile opens the part of the site it counts. Zero tiles are left out. */
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
    <span className="home-metric-icon" aria-hidden="true">{ICONS[metric.key]}</span>
    <strong>{count.format(metric.value)}</strong>
    <span>{metric.label}</span>
  </Link></li>)}</ul>;
}
