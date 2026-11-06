import { moscowDay } from '@/lib/drink-calendar-fields';
import { seasonTitle } from '@/lib/season-fields';
import Image from 'next/image';
import Link from '@/components/navigation-progress';
import { BETA_ENGINE_PLACES, type BetaEngine } from '@/lib/beta-engine';
import type { Contest } from '@/lib/contest';
import type { HomeMetrics } from '@/lib/home-metrics';
import { marketOpen } from '@/lib/market-open';

const count = new Intl.NumberFormat('ru-RU');

/**
 * The section art: 3D renders from the owner's Figma file (frame «Логотип», 4002:61) in `public/brand/home3d`, trimmed
 * to the object, so each keeps its own proportions — width and height go to the image as they are.
 */
const ART = {
  catalog: [425, 480], prices: [425, 480], stores: [480, 474], tierlists: [391, 480], leaderboard: [411, 480],
  pass: [387, 480], engine: [480, 420], dating: [480, 465], business: [480, 474], market: [466, 480],
} as const;
const art = (key: keyof typeof ART) => ({ src: `/brand/home3d/${key}.webp`, width: ART[key][0], height: ART[key][1] });
const OLD_ART = (src: string) => ({ src, width: 120, height: 120 });

/**
 * The home page's services, like a super app's start screen: four big categories with their own art standing over the
 * plate (catalog, prices, stores, tier lists, each with its live number), then one row of small icons for the week's
 * race, the pass, the giveaway, the beta «Двигатель» places, drink dating, the market and business. The row scrolls
 * sideways on phones.
 */
export function HomeServices({ metrics, contest, joined, engine }: {
  metrics: HomeMetrics;
  /** The season's «Банкомат» banner is on the page: its small icon steps aside */
  contest: { contest: Contest; phase: 'open' | 'results' } | null;
  joined: boolean;
  engine: BetaEngine;
}) {
  // Sections with a switcher open in it (/search, /community), as from the tab bar: the bare pages (/catalog,
  // /tierlists, /market…) have no «Каталог / Магазины / Маркет» or «Тирлисты / Дейтинг / Люди» row on a phone.
  const big = [
    { key: 'catalog', href: '/search', label: 'Каталог', note: metrics.drinks ? count.format(metrics.drinks) : '', art: art('catalog') },
    { key: 'prices', href: '/prices', label: 'Цены', note: metrics.stores ? `${count.format(metrics.stores)} маг.` : '', art: art('prices') },
    { key: 'stores', href: '/search?type=stores', label: 'Магазины', note: 'на карте', art: art('stores') },
    { key: 'tierlists', href: '/community', label: 'Тирлисты', note: metrics.tierLists ? count.format(metrics.tierLists) : '', art: art('tierlists') },
  ];
  const small = [
    { key: 'leaderboard', href: '/leaderboard', label: 'Лидеры', note: 'гонка недели', art: art('leaderboard') },
    { key: 'pass', href: '/pass', label: 'Пропуск', note: seasonTitle(moscowDay().slice(0, 7)), art: art('pass') },
    ...(contest?.phase === 'open' ? [{ key: 'contest', href: '/contest', label: 'Конкурс', note: joined ? 'вы участвуете' : `до ${contest.contest.lastDayLabel}`, art: OLD_ART('/brand/home/contest.png') }] : []),
    ...(engine.taken < BETA_ENGINE_PLACES ? [{ key: 'engine', href: '/engine', label: 'Бета сайта', note: 'каждый важен', art: art('engine') }] : []),
    { key: 'dating', href: '/community?type=dating', label: 'Дейтинг', note: 'рекомендации', art: art('dating') },
    ...(marketOpen() ? [{ key: 'market', href: '/search?type=market', label: 'Маркет', note: 'объявления', art: art('market') }] : []),
    // The landing for brands, distributors and shops (CanRush для бизнеса).
    { key: 'business', href: '/business', label: 'Бизнес', note: 'для брендов', art: art('business') },
  ];
  return <nav className="home-services" aria-label="Разделы">
    <ul className="go-tiles">{big.map(item => <li key={item.key}><Link className="go-tile" href={item.href} data-tile={item.key}>
      <span className="go-tile-plate"><Image {...item.art} sizes="(max-width: 639px) 42vw, 220px" alt="" priority /></span>
      <span className="go-tile-label">{item.label}{item.note && <small> · {item.note}</small>}</span>
    </Link></li>)}</ul>
    <ul className="go-icons">{small.map(item => <li key={item.key}><Link className="go-icon" href={item.href} data-icon={item.key}>
      <span className="go-icon-plate"><Image {...item.art} sizes="72px" alt="" /></span>
      <span className="go-icon-label">{item.label}</span>
      <small>{item.note}</small>
    </Link></li>)}</ul>
  </nav>;
}
