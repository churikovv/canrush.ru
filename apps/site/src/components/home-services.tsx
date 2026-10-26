import Image from 'next/image';
import Link from '@/components/navigation-progress';
import { BETA_ENGINE_PLACES, type BetaEngine } from '@/lib/beta-engine';
import type { Contest } from '@/lib/contest';
import type { HomeMetrics } from '@/lib/home-metrics';

const count = new Intl.NumberFormat('ru-RU');

/**
 * The home page's services, like a super app's start screen: four big categories with their own art (Figma 704:1526,
 * `public/brand/home`) standing over the plate (catalog, prices, stores, tier lists, each with its live number), then one row of small icons for the month's
 * top, the giveaway, the beta «Двигатель» places and drink dating. The row scrolls sideways on phones.
 */
export function HomeServices({ metrics, contest, joined, engine }: {
  metrics: HomeMetrics;
  contest: { contest: Contest; phase: 'open' | 'results' } | null;
  joined: boolean;
  engine: BetaEngine;
}) {
  const big = [
    { key: 'catalog', href: '/catalog', label: 'Каталог', note: metrics.drinks ? count.format(metrics.drinks) : '', art: 'catalog' },
    { key: 'prices', href: '/prices', label: 'Цены', note: metrics.stores ? `${count.format(metrics.stores)} маг.` : '', art: 'prices' },
    { key: 'stores', href: '/market/stores', label: 'Магазины', note: 'на карте', art: 'stores' },
    { key: 'tierlists', href: '/tierlists', label: 'Тирлисты', note: metrics.tierLists ? count.format(metrics.tierLists) : '', art: 'tierlists' },
  ];
  const small = [
    { key: 'leaderboard', href: '/leaderboard', label: 'Лидеры', note: 'таблица', art: '/brand/home/leaderboard.png' },
    ...(contest ? [{ key: 'contest', href: '/contest', label: 'Конкурс', note: contest.phase === 'open' ? (joined ? 'вы участвуете' : `до ${contest.contest.lastDayLabel}`) : 'итоги', art: contest.contest.image.src }] : []),
    ...(engine.taken < BETA_ENGINE_PLACES ? [{ key: 'engine', href: '/engine', label: 'Бета сайта', note: 'каждый важен', art: '/brand/achievements/engine.png' }] : []),
    { key: 'dating', href: '/community?type=dating', label: 'Дейтинг', note: 'рекомендации', art: '/brand/achievements/date.png' },
    { key: 'market', href: '/market', label: 'Маркет', note: 'объявления', art: '/brand/home/market.png' },
  ];
  return <nav className="home-services" aria-label="Разделы">
    <ul className="go-tiles">{big.map(item => <li key={item.key}><Link className="go-tile" href={item.href} data-tile={item.key}>
      <span className="go-tile-plate"><Image src={`/brand/home/${item.art}.png`} width={480} height={480} sizes="(max-width: 639px) 42vw, 220px" alt="" priority /></span>
      <span className="go-tile-label">{item.label}{item.note && <small> · {item.note}</small>}</span>
    </Link></li>)}</ul>
    <ul className="go-icons">{small.map(item => <li key={item.key}><Link className="go-icon" href={item.href} data-icon={item.key}>
      <span className="go-icon-plate"><Image src={item.art} width={120} height={120} sizes="72px" alt="" /></span>
      <span className="go-icon-label">{item.label}</span>
      <small>{item.note}</small>
    </Link></li>)}</ul>
  </nav>;
}
