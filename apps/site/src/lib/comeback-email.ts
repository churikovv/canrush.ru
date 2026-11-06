import { getPool } from '@/db/pool';
import { articleSummary, readingMinutes, type ArticleBlock } from '@/lib/article-fields';
import { AWARD, AWARD_CATEGORIES, awardPhase } from '@/lib/awards-fields';
import { canonicalDrink } from '@/lib/brand-collection-fields';
import { catalogGroupSlug, flavorName } from '@/lib/catalog-query';
import {
  COMEBACK_AWAY_DAYS, COMEBACK_DAILY_LIMIT, COMEBACK_GAP_DAYS, COMEBACK_MAX_LETTERS, COMEBACK_NEWS_DAYS, COMEBACK_PREFERENCE,
  hasNews, isUnsubscribeToken, plural, unsubscribeToken, type ComebackDigest, type ComebackDrink, type ComebackEvent,
} from '@/lib/comeback-email-fields';
import { getAuthEnv } from '@/lib/env';
import { huntLastDay } from '@/lib/hunt-fields';
import { huntOpenEvent } from '@/lib/hunt';
import { storeDrinkOptions, type StoreDrinkOption } from '@/lib/store-catalog';
import { moscowClock } from '@/lib/telegram-bot/jobs';

const DAY_MS = 86_400_000;
const POPULAR_DAYS = 7;
const POPULAR_SHOWN = 3;
const NEW_DRINKS_SHOWN = 4;
const ARTICLES_SHOWN = 2;
const key = (brand: string, flavor: string) => JSON.stringify([brand, flavor]);
const NOT_BANNED = (column: string) => `not exists(select 1 from "userBlock" ub where ub."userId" = ${column})`;

/** Отправка одного письма; в тестах подменяется, чтобы настоящие письма не уходили. */
export type ComebackMail = (to: string, digest: ComebackDigest, unsubscribe: string) => Promise<void>;

interface Shared {
  base: string;
  options: Map<string, StoreDrinkOption>;
  popular: ComebackDrink[];
  award: 'open' | 'results' | null;
  hunt: ComebackEvent | null;
}

const absolute = (base: string, path: string | null | undefined) => path ? (path.startsWith('/') ? `${base}${path}` : path) : null;

function drinkOf(shared: Shared, brand: string, flavor: string, note?: string): ComebackDrink | null {
  const option = shared.options.get(key(brand, flavor));
  if (!option) return null;
  return { brand: option.brand, name: flavorName(option.flavor), href: `${shared.base}/catalog/${catalogGroupSlug(option.brand, option.flavor)}`, cover: absolute(shared.base, option.cover), ...(note ? { note } : {}) };
}

/**
 * Общее для всех писем прохода: каталог, популярное за неделю (больше всего отзывов за 7 дней, от двух, без авторов под
 * баном, старые идентичности считаются за нынешние) и события сайта.
 */
async function loadShared(now: number): Promise<Shared> {
  const base = getAuthEnv().authUrl;
  const [options, reviews, hunt] = await Promise.all([
    storeDrinkOptions().then(list => new Map(list.map(option => [key(option.brand, option.flavor), option]))),
    getPool().query<{ brand: string; flavor: string; reviews: number; score: number }>(
      `select r.brand, r.flavor, count(*)::int as reviews, avg((r.taste + r.design) / 2.0)::float8 as score
       from review r where r."createdAt" > $1 and ${NOT_BANNED('r."userId"')} group by r.brand, r.flavor`, [new Date(now - POPULAR_DAYS * DAY_MS)]),
    huntOpenEvent(now).catch(() => null),
  ]);
  const totals = new Map<string, { brand: string; flavor: string; reviews: number; sum: number }>();
  for (const row of reviews.rows) {
    const identity = canonicalDrink(row.brand, row.flavor);
    const id = key(identity.brand, identity.flavor);
    const before = totals.get(id) ?? { ...identity, reviews: 0, sum: 0 };
    totals.set(id, { ...before, reviews: before.reviews + row.reviews, sum: before.sum + row.score * row.reviews });
  }
  const shared: Shared = { base, options, popular: [], award: null, hunt: null };
  shared.popular = [...totals.values()].filter(item => item.reviews >= 2)
    .sort((a, b) => b.reviews - a.reviews || b.sum / b.reviews - a.sum / a.reviews)
    .flatMap(item => {
      const score = (item.sum / item.reviews).toLocaleString('ru-RU', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
      const drink = drinkOf(shared, item.brand, item.flavor, `★ ${score} · ${item.reviews} ${plural(item.reviews, 'отзыв', 'отзыва', 'отзывов')} за неделю`);
      return drink ? [drink] : [];
    }).slice(0, POPULAR_SHOWN);
  const phase = awardPhase(now);
  shared.award = phase === 'open' || phase === 'results' ? phase : null;
  shared.hunt = hunt ? {
    key: 'hunt', title: 'Охота за ценниками', button: 'Начать охоту', href: `${base}/hunt`, image: null,
    text: `Добавляйте магазины с ценами на карту CanRush и получайте ценники — их можно обменять на рубли. Приём до ${huntLastDay(hunt.endsAt)}.`,
  } : null;
  return shared;
}

/**
 * Письмо одного участника: события сайта, непрочитанные уведомления, новые напитки участников и статьи с прошлого
 * захода (или прошлого письма, но не дальше `COMEBACK_NEWS_DAYS`), популярное за неделю.
 */
async function digestFor(shared: Shared, user: { id: string; username: string | null; since: Date }): Promise<ComebackDigest> {
  const db = getPool();
  const [unread, drinks, articles, votes] = await Promise.all([
    db.query<{ count: number }>(`select count(*)::int as count from notification where "userId" = $1 and "readAt" is null`, [user.id]),
    db.query<{ brand: string; flavor: string; total: number }>(
      `select d.brand, d.flavor, count(*) over ()::int as total from "catalogDrink" d
       where d.status = 'published' and not d.discontinued and coalesce(d."reviewedAt", d."createdAt") > $1 and ${NOT_BANNED('d."ownerId"')}
       order by coalesce(d."reviewedAt", d."createdAt") desc limit 12`, [user.since]),
    db.query<{ id: string; title: string; blocks: ArticleBlock[] }>(
      `select a.id, a.title, a.blocks from article a where a.status = 'published' and a."publishedAt" > $1 and ${NOT_BANNED('a."authorId"')}
       order by a."publishedAt" desc limit $2`, [user.since, ARTICLES_SHOWN]),
    shared.award === 'open' ? db.query<{ count: number }>(`select count(*)::int as count from "awardVote" where award = $1 and "userId" = $2`, [AWARD.key, user.id]) : null,
  ]);
  const events: ComebackEvent[] = [];
  if (shared.award === 'open' && (votes?.rows[0]?.count ?? 0) < AWARD_CATEGORIES.length) events.push({
    key: 'award', title: `${AWARD.title} ${AWARD.year}`, button: 'Голосовать', href: `${shared.base}/awards`, image: `${shared.base}/brand/mail/trophy.png`,
    text: `Участники выбирают энергетики года: лучший дизайн, лучший вкус, энергетик года и лучший без сахара. Голосование до ${AWARD.lastDayLabel}.`,
  });
  if (shared.award === 'results') events.push({
    key: 'award', title: `${AWARD.title} ${AWARD.year}`, button: 'Смотреть итоги', href: `${shared.base}/awards`, image: `${shared.base}/brand/mail/trophy.png`,
    text: 'Голоса посчитаны: участники CanRush выбрали лучшие энергетики года в четырёх номинациях.',
  });
  if (shared.hunt) events.push(shared.hunt);
  const fresh = drinks.rows.flatMap(row => { const drink = drinkOf(shared, row.brand, row.flavor); return drink ? [drink] : []; });
  return {
    username: user.username,
    events,
    unread: unread.rows[0]?.count ?? 0,
    newDrinks: { total: fresh.length ? drinks.rows[0]?.total ?? fresh.length : 0, items: fresh.slice(0, NEW_DRINKS_SHOWN) },
    popular: shared.popular,
    articles: articles.rows.map(row => ({ title: row.title, summary: articleSummary(row.blocks, 140), minutes: readingMinutes(row.blocks), href: `${shared.base}/news/${row.id}` })),
  };
}

export function unsubscribeUrl(userId: string, path = '/unsubscribe'): string {
  const { authUrl, authSecret } = getAuthEnv();
  const url = new URL(path, authUrl);
  url.searchParams.set('u', userId);
  url.searchParams.set('t', unsubscribeToken(userId, authSecret));
  return url.toString();
}

/**
 * Кому письмо сегодня: подтверждённая почта (не заглушка Telegram), не под баном, не отписан, не заходил
 * `COMEBACK_AWAY_DAYS` дней, последнее письмо — не ближе `COMEBACK_GAP_DAYS` дней, и после последнего захода ушло меньше
 * `COMEBACK_MAX_LETTERS` писем. Сначала те, кто заходил недавно: их проще вернуть.
 */
async function candidates(now: Date, limit: number) {
  return (await getPool().query<{ id: string; email: string; username: string | null; seenAt: Date; lastLetter: Date | null }>(
    `select u.id, u.email, u.username, coalesce(u."lastSeenAt", u."createdAt") as "seenAt",
       (select max(c."sentAt") from "comebackEmail" c where c."userId" = u.id and c."failedAt" is null) as "lastLetter"
     from "user" u
     where u."emailVerified" and u.email is not null and lower(u.email) not like '%.telegram.invalid'
       and coalesce(u."lastSeenAt", u."createdAt") < $1::timestamptz - make_interval(days => $2)
       and ${NOT_BANNED('u.id')}
       and not exists(select 1 from "notificationPreference" p where p."userId" = u.id and p.kind = $3 and not p.enabled)
       and not exists(select 1 from "comebackEmail" c where c."userId" = u.id and c."sentAt" > $1::timestamptz - make_interval(days => $4))
       and (select count(*) from "comebackEmail" c where c."userId" = u.id and c."failedAt" is null
              and c."sentAt" > coalesce(u."lastSeenAt", u."createdAt")) < $5
     order by coalesce(u."lastSeenAt", u."createdAt") desc, u.id
     limit $6`,
    [now, COMEBACK_AWAY_DAYS, COMEBACK_PREFERENCE, COMEBACK_GAP_DAYS, COMEBACK_MAX_LETTERS, limit])).rows;
}

/**
 * Проход рассылки: до `COMEBACK_DAILY_LIMIT` писем за московские сутки. Каждое письмо сначала занимает строку
 * `comebackEmail` (участник и день), поэтому второй проход и второй инстанс его не повторят; сбой помечается `failedAt`
 * и не повторяется до следующего окна. Письмо без новостей (только популярное) не уходит.
 */
export async function runComebackEmails(options: { now?: number; send?: ComebackMail; pauseMs?: number; limit?: number } = {}): Promise<{ sent: number; failed: number; skipped: number }> {
  const now = options.now ?? Date.now();
  const at = new Date(now);
  const day = moscowClock(at).date;
  const db = getPool();
  const limit = options.limit ?? COMEBACK_DAILY_LIMIT;
  const today = (await db.query<{ count: number }>(`select count(*)::int as count from "comebackEmail" where day = $1`, [day])).rows[0]?.count ?? 0;
  const left = limit - today;
  if (left <= 0) return { sent: 0, failed: 0, skipped: 0 };
  const rows = await candidates(at, left * 3);
  if (!rows.length) return { sent: 0, failed: 0, skipped: 0 };
  const mail = options.send ?? (await import('@/lib/email')).sendComebackEmail;
  const shared = await loadShared(now);
  const pause = options.pauseMs ?? 1500;
  let sent = 0, failed = 0, skipped = 0;
  for (const row of rows) {
    if (sent + failed >= left) break;
    const newsSince = Math.max(row.seenAt.getTime(), row.lastLetter?.getTime() ?? 0, now - COMEBACK_NEWS_DAYS * DAY_MS);
    const digest = await digestFor(shared, { id: row.id, username: row.username, since: new Date(newsSince) });
    if (!hasNews(digest)) { skipped++; continue; }
    const claimed = await db.query(`insert into "comebackEmail" ("userId", day, "sentAt") values ($1, $2, $3) on conflict do nothing`, [row.id, day, at]);
    if (!claimed.rowCount) continue;
    try { await mail(row.email, digest, unsubscribeUrl(row.id)); sent++; }
    catch (error) {
      failed++;
      await db.query(`update "comebackEmail" set "failedAt" = now() where "userId" = $1 and day = $2`, [row.id, day]).catch(() => undefined);
      console.error('[comeback-email] letter failed', error instanceof Error ? error.message : 'unknown');
    }
    if (pause) await new Promise(resolve => setTimeout(resolve, pause));
  }
  return { sent, failed, skipped };
}

/** Отписка по ссылке из письма, без входа: подпись проверяется, участник должен существовать. */
export async function unsubscribeComeback(userId: unknown, token: unknown): Promise<boolean> {
  if (typeof userId !== 'string' || !isUnsubscribeToken(userId, token, getAuthEnv().authSecret)) return false;
  const result = await getPool().query(
    `insert into "notificationPreference" ("userId", kind, enabled) select id, $2, false from "user" where id = $1
     on conflict ("userId", kind) do update set enabled = false`, [userId, COMEBACK_PREFERENCE]);
  return Boolean(result.rowCount);
}

/** Подписан ли участник по ссылке: страница отписки показывает «уже отписаны». */
export async function comebackSubscribed(userId: string): Promise<boolean> {
  const { rows } = await getPool().query<{ enabled: boolean }>(`select enabled from "notificationPreference" where "userId" = $1 and kind = $2`, [userId, COMEBACK_PREFERENCE]);
  return rows[0]?.enabled ?? true;
}
