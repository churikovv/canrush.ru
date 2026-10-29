/**
 * Giveaways. A new contest is one more entry in CONTESTS: the home banner shows the earliest one still running,
 * /contest holds its rules and /admin/contest lists every contest as a card with its own draw page.
 */
export interface Contest {
  /** Stable id: stored in "contestDraw".contest and used in the admin URL. */
  key: string;
  title: string;
  prize: string;
  /** Banner heading and lead while entries are open. */
  heading: string;
  lead: string;
  image: { src: string; width: number; height: number; alt: string };
  /** Secret profile tag the confirmed winner receives (see PROFILE_ACHIEVEMENTS), or null. */
  tag: string | null;
  tagLabel?: string;
  /** Calendar cans logged on these Moscow days enter the draw; `firstDay` null means any earlier day too. */
  firstDay: string | null;
  lastDay: string;
  lastDayLabel: string;
  /** Results day; the banner stays up until it ends (Moscow time). */
  resultsDay: string;
  resultsLabel: string;
}

export const CONTESTS: readonly Contest[] = [
  {
    key: 'box-2026-10',
    title: 'Ящик энергетиков',
    prize: '3500 ₽',
    heading: 'Выиграй ящик энергетиков на 3500 ₽',
    lead: 'Купим любые энергетики на 3500 ₽ — состав выбираешь сам. Победитель получит секретный тег на сайте.',
    image: { src: '/brand/contest/box-3500.webp', width: 900, height: 1143, alt: 'Ящик энергетиков на 3500 ₽ и совы Canrush' },
    tag: 'energizer',
    tagLabel: 'Энерджайзер',
    firstDay: null,
    lastDay: '2026-10-31',
    lastDayLabel: '31 октября',
    resultsDay: '2026-11-01',
    resultsLabel: '1 ноября',
  },
];

export const findContest = (key: string) => CONTESTS.find(contest => contest.key === key);

export interface ContestEntry {
  /** Cans logged in the drink calendar within the contest days. */
  cans: number;
  /** Personal Telegram in the profile or a linked Telegram account. */
  telegram: boolean;
  /** An avatar: the "filled profile" signal that the entrant is not a bot. */
  avatar: boolean;
}

/** Moscow calendar day of a moment, as YYYY-MM-DD. */
export function moscowDay(at: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}

export type ContestPhase = 'upcoming' | 'open' | 'results' | 'over';
export function contestPhase(contest: Contest, at: Date): ContestPhase {
  const day = moscowDay(at);
  if (contest.firstDay && day < contest.firstDay) return 'upcoming';
  return day <= contest.lastDay ? 'open' : day <= contest.resultsDay ? 'results' : 'over';
}

/** The contest the site shows: the earliest one that is open or announcing results. */
export function currentContest(at: Date): { contest: Contest; phase: 'open' | 'results' } | null {
  for (const contest of [...CONTESTS].sort((a, b) => a.resultsDay.localeCompare(b.resultsDay))) {
    const phase = contestPhase(contest, at);
    if (phase === 'open' || phase === 'results') return { contest, phase };
  }
  return null;
}

/** Only the calendar is required; Telegram and the avatar are asked for so the winner can be reached and checked. */
export function contestChecklist(entry: ContestEntry) {
  return [
    { key: 'calendar', done: entry.cans > 0, required: true, label: 'Отметить хотя бы одну банку в трекере выпитого' },
    { key: 'telegram', done: entry.telegram, required: false, label: 'Указать свой Telegram в профиле, чтобы мы могли написать' },
    { key: 'avatar', done: entry.avatar, required: false, label: 'Заполнить профиль: поставить аватар' },
  ] as const;
}

export interface DrawFilters { telegram: boolean; avatar: boolean }
export function eligibleForDraw(entry: ContestEntry, filters: DrawFilters): boolean {
  return entry.cans > 0 && (!filters.telegram || entry.telegram) && (!filters.avatar || entry.avatar);
}

export type DrawStatus = 'pending' | 'confirmed' | 'unreachable';
export const DRAW_STATUS_LABELS: Record<DrawStatus, string> = { pending: 'Ждём ответа', confirmed: 'Связались', unreachable: 'Не вышел на связь' };
