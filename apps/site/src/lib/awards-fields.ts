/**
 * «Премия за энергию»: the members' yearly vote for the drinks of the year, in four categories (/awards). Rules without
 * the database, shared by the page, the server and tests. Nominees are the best drinks by the members' own ratings —
 * a Bayesian average, so three perfect reviews don't outrank a hundred good ones — plus any catalog drink a member adds
 * as their vote. One vote per category, changeable while voting is open; the shares show once the member has voted.
 */
export const AWARD = {
  key: '2026',
  year: 2026,
  title: 'Премия за энергию',
  /** Voting runs from this moment (Moscow) up to `closesAt`, not included. */
  opensAt: '2026-11-06T00:00:00+03:00',
  closesAt: '2026-12-28T00:00:00+03:00',
  /** Last voting day and the results day, as the page writes them. */
  lastDayLabel: '27 декабря',
  resultsLabel: '28 декабря',
  /** The icon and the story stay on the home page with the results until then. */
  shownUntil: '2027-01-15T00:00:00+03:00',
} as const;

export type AwardMetric = 'design' | 'taste' | 'overall';
export const AWARD_CATEGORIES = [
  { key: 'design', title: 'Лучший дизайн', hint: 'Банка, которую хочется поставить на полку', metric: 'design' as AwardMetric, sugarFree: false },
  { key: 'taste', title: 'Лучший вкус', hint: 'Вкус, к которому возвращаешься', metric: 'taste' as AwardMetric, sugarFree: false },
  { key: 'drink', title: 'Энергетик года', hint: 'Главный энергетик года по мнению участников', metric: 'overall' as AwardMetric, sugarFree: false },
  { key: 'sugarfree', title: 'Лучший без сахара', hint: 'Без сахара или на сахарозаменителе', metric: 'overall' as AwardMetric, sugarFree: true },
] as const;
export type AwardCategory = (typeof AWARD_CATEGORIES)[number]['key'];
export const isAwardCategory = (value: unknown): value is AwardCategory => AWARD_CATEGORIES.some(category => category.key === value);
export const awardCategory = (key: AwardCategory) => AWARD_CATEGORIES.find(category => category.key === key)!;

/** Nominees from the data per category. */
export const AWARD_SEEDS = 6;
/** Reviews a drink needs to be nominated by the data. */
export const AWARD_MIN_REVIEWS = 3;
/** How strongly a drink with few reviews is pulled to the catalog's average (reviews' worth). */
export const AWARD_PRIOR = 5;
/** A vote needs a nickname and an account at least this old: a fresh account is the cheapest way to stuff the vote. */
export const AWARD_MIN_ACCOUNT_DAYS = 3;

export type AwardPhase = 'upcoming' | 'open' | 'results' | 'over';
export function awardPhase(now = Date.now()): AwardPhase {
  if (now < Date.parse(AWARD.opensAt)) return 'upcoming';
  if (now < Date.parse(AWARD.closesAt)) return 'open';
  return now < Date.parse(AWARD.shownUntil) ? 'results' : 'over';
}

/**
 * Without sugar: the catalog key's mark (`:sugarfree`, `:sweetener`) or a line that is sugar-free by name — «Zero»,
 * Monster «Ultra», «без сахара» in the drink's name.
 */
export function isSugarFreeDrink(flavor: string, name = ''): boolean {
  return /(?:^|:)(?:sugarfree|sweetener)\b/.test(flavor) || /_ultra_|\bzero\b/i.test(flavor) || /\b(?:zero|ultra)\b|без сахара|сахарозамен/i.test(name);
}

export interface RatedDrink { brand: string; flavor: string; reviews: number; taste: number; design: number }

const metricOf = (drink: RatedDrink, metric: AwardMetric) => metric === 'design' ? drink.design : metric === 'taste' ? drink.taste : (drink.taste + drink.design) / 2;

/** A drink's score for a category: its average pulled to the catalog's by `AWARD_PRIOR` reviews. */
export function awardScore(drink: RatedDrink, metric: AwardMetric, mean: number): number {
  return (metricOf(drink, metric) * drink.reviews + mean * AWARD_PRIOR) / (drink.reviews + AWARD_PRIOR);
}

/** The data's nominees of a category: drinks with enough reviews, the best scores first. `names` — catalog names, for sugar-free lines. */
export function seedNominees(category: AwardCategory, drinks: readonly RatedDrink[], names: ReadonlyMap<string, string> = new Map()): RatedDrink[] {
  const { metric, sugarFree } = awardCategory(category);
  const rated = drinks.filter(drink => drink.reviews >= AWARD_MIN_REVIEWS);
  const pool = sugarFree ? rated.filter(drink => isSugarFreeDrink(drink.flavor, names.get(JSON.stringify([drink.brand, drink.flavor])) ?? '')) : rated;
  if (!pool.length) return [];
  const mean = rated.reduce((sum, drink) => sum + metricOf(drink, metric) * drink.reviews, 0) / rated.reduce((sum, drink) => sum + drink.reviews, 0);
  return [...pool].sort((a, b) => awardScore(b, metric, mean) - awardScore(a, metric, mean) || b.reviews - a.reviews || a.brand.localeCompare(b.brand, 'ru'))
    .slice(0, AWARD_SEEDS);
}

/** Why a member can't vote, or null. */
export function voteBlock(member: { username: string | null; blocked: boolean; createdAt: Date } | null, now = Date.now()): string | null {
  if (!member) return 'Войдите, чтобы проголосовать.';
  if (member.blocked) return 'Аккаунт заблокирован: голосовать нельзя.';
  if (!member.username) return 'Придумайте ник в настройках профиля — голосуют участники с ником.';
  if (now - member.createdAt.getTime() < AWARD_MIN_ACCOUNT_DAYS * 86_400_000) return `Голосовать можно через ${AWARD_MIN_ACCOUNT_DAYS} дня после регистрации — так голоса не накрутить новыми аккаунтами.`;
  return null;
}

/** «12 голосов». */
export function votesLabel(count: number): string {
  const ones = count % 10, tens = count % 100;
  return `${new Intl.NumberFormat('ru-RU').format(count)} ${ones === 1 && tens !== 11 ? 'голос' : ones >= 2 && ones <= 4 && (tens < 12 || tens > 14) ? 'голоса' : 'голосов'}`;
}

/** Each nominee's share of the category's votes, whole percent. */
export const voteShare = (votes: number, total: number) => total ? Math.round(votes / total * 100) : 0;
