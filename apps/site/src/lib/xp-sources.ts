import { COLLECTION_MILESTONES } from '@/lib/brand-collection-fields';
import { SWIPE_XP, SWIPE_XP_LIMIT } from '@/lib/drink-swipes';
import { STORE_XP } from '@/lib/store-fields';

export interface XpSource { reason: string; title: string; note: string; points: number; upTo?: boolean; href: string; art: string }

/**
 * За что дают опыт: суммы и лимиты повторяют `award_profile_experience`, их сверяет `test/seasons.integration.test.ts`.
 * Трекера банок здесь нет намеренно: сайт 18+, опыт за выпитое нельзя показывать как способ заработать.
 */
export const XP_SOURCES: readonly XpSource[] = [
  { reason: 'store', title: 'Магазин на карте', note: 'После проверки, до 20 магазинов', points: STORE_XP, href: '/market/stores/new', art: '/brand/home/stores.png' },
  { reason: 'collection', title: 'Коллекция вкусов', note: 'За четверть, половину и весь бренд', points: Math.max(...COLLECTION_MILESTONES.map(([, points]) => points)), upTo: true, href: '/profile', art: '/brand/achievements/collector.png' },
  { reason: 'catalog-drink', title: 'Новый напиток', note: 'После проверки', points: 50, href: '/catalog/new', art: '/brand/home/catalog.png' },
  { reason: 'tierlist', title: 'Тирлист', note: 'Первые 10 тирлистов', points: 50, href: '/tierlists/new', art: '/brand/home/tierlists.png' },
  { reason: 'review', title: 'Отзыв о напитке', note: 'За каждый напиток', points: 25, href: '/search', art: '/brand/achievements/first-review.png' },
  { reason: 'achievement', title: 'Достижение', note: 'За каждый новый тег', points: 20, href: '/profile', art: '/brand/achievements/top.png' },
  { reason: 'swipe', title: 'Свайп в дейтинге', note: `Первые ${SWIPE_XP_LIMIT} свайпов`, points: SWIPE_XP, href: '/community?type=dating', art: '/brand/home/dating.png' },
  { reason: 'favorite', title: 'Избранное', note: 'Первые 20 напитков', points: 2, href: '/search', art: '/brand/achievements/date.png' },
];
