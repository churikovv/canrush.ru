import { randomInt } from 'node:crypto';
import type { PoolClient } from 'pg';
import { getPool } from '@/db/pool';
import { contestPhase, eligibleForDraw, type Contest, type ContestEntry, type DrawFilters, type DrawStatus } from './contest';

export interface ContestParticipant extends ContestEntry {
  id: string; username: string | null; name: string; email: string; createdAt: Date;
  telegramUsername: string | null; telegramLinked: boolean; days: number; firstDay: string; lastDay: string;
  /** Status of this member's latest draw in the contest, if drawn. */
  drawStatus: DrawStatus | null;
}
export interface ContestDraw {
  id: string; winnerId: string | null; winnerUsername: string | null; poolSize: number; filters: DrawFilters;
  status: DrawStatus; drawnBy: string; drawnAt: Date; resolvedBy: string | null; resolvedAt: Date | null;
}
export class ContestError extends Error {}

// $1, $2: the contest's first (nullable) and last day.
const IN_DAYS = `d."userId" = u.id and d.day <= $2::date and ($1::date is null or d.day >= $1::date)`;
const ENTRY = `
  (select count(*)::int from "drinkLog" d where ${IN_DAYS}) as cans,
  (u."telegramUsername" is not null or exists(select 1 from account a where a."userId" = u.id and a."providerId" = 'telegram')) as telegram,
  exists(select 1 from "profileImage" p where p."userId" = u.id and p.kind = 'avatar') as avatar`;
const days = (contest: Contest) => [contest.firstDay, contest.lastDay];

/** The signed-in member's progress for the banner. */
export async function getContestEntry(contest: Contest, userId: string): Promise<ContestEntry & { username: string | null }> {
  const { rows } = await getPool().query<ContestEntry & { username: string | null }>(`select u.username, ${ENTRY} from "user" u where u.id = $3`, [...days(contest), userId]);
  return rows[0] ?? { username: null, cans: 0, telegram: false, avatar: false };
}

/** Everyone who logged a can within the contest days, except blocked members and site admins (organizers do not take part). */
export async function getContestParticipants(contest: Contest): Promise<ContestParticipant[]> {
  const { rows } = await getPool().query<ContestParticipant>(`select u.id, u.username, u.name, u.email, u."createdAt", u."telegramUsername",
      exists(select 1 from account a where a."userId" = u.id and a."providerId" = 'telegram') as "telegramLinked",
      ${ENTRY},
      (select count(distinct d.day)::int from "drinkLog" d where ${IN_DAYS}) as days,
      (select to_char(min(d.day), 'YYYY-MM-DD') from "drinkLog" d where ${IN_DAYS}) as "firstDay",
      (select to_char(max(d.day), 'YYYY-MM-DD') from "drinkLog" d where ${IN_DAYS}) as "lastDay",
      (select c.status from "contestDraw" c where c.contest = $3 and c."winnerId" = u.id order by c."drawnAt" desc limit 1) as "drawStatus"
    from "user" u
    where exists(select 1 from "drinkLog" d where ${IN_DAYS})
      and not exists(select 1 from "userBlock" b where b."userId" = u.id)
      and not exists(select 1 from "siteAdmin" s where s.email = lower(u.email))
    order by u."createdAt"`, [...days(contest), contest.key]);
  return rows;
}

export async function getContestDraws(contest: Contest): Promise<ContestDraw[]> {
  const { rows } = await getPool().query<ContestDraw>(`select d.id, d."winnerId", u.username as "winnerUsername", d."poolSize", d.filters, d.status,
      d."drawnBy", d."drawnAt", d."resolvedBy", d."resolvedAt"
    from "contestDraw" d left join "user" u on u.id = d."winnerId" where d.contest = $1 order by d."drawnAt" desc`, [contest.key]);
  return rows;
}

/** Card data for the admin contest list. */
export async function getContestOverview(contest: Contest) {
  const [participants, draws] = await Promise.all([getContestParticipants(contest), getContestDraws(contest)]);
  return { participants: participants.length, withTelegram: participants.filter(entry => entry.telegram).length, current: draws.find(draw => draw.status !== 'unreachable') ?? null, redraws: draws.filter(draw => draw.status === 'unreachable').length };
}

const audit = (client: PoolClient, adminEmail: string, action: string, target: string) =>
  client.query('insert into "adminAuditLog" ("adminEmail", action, "targetType", "targetId") values ($1, $2, $3, $4)', [adminEmail, action, 'contest', target]);

/** Picks a winner uniformly among the filtered pool, leaving out members who already did not answer in this contest. */
async function insertDraw(client: PoolClient, contest: Contest, adminEmail: string, filters: DrawFilters) {
  const unreachable = new Set((await client.query<{ winnerId: string }>(`select "winnerId" from "contestDraw" where contest = $1 and status = 'unreachable' and "winnerId" is not null`, [contest.key])).rows.map(row => row.winnerId));
  const pool = (await getContestParticipants(contest)).filter(entry => eligibleForDraw(entry, filters) && !unreachable.has(entry.id));
  if (!pool.length) throw new ContestError('Под эти условия больше никто не подходит.');
  const winner = pool[randomInt(pool.length)]!;
  const { rows } = await client.query<{ id: string }>(`insert into "contestDraw" (contest, "winnerId", "poolSize", pool, filters, "drawnBy")
    values ($1, $2, $3, $4::jsonb, $5::jsonb, $6) returning id`, [contest.key, winner.id, pool.length, JSON.stringify(pool.map(entry => entry.id)), JSON.stringify(filters), adminEmail]);
  await audit(client, adminEmail, 'draw', `${contest.key}:${winner.id}`);
  return { id: rows[0]!.id, winnerId: winner.id, winnerLabel: winner.username ? `@${winner.username}` : winner.name.trim() || winner.email, poolSize: pool.length };
}

async function transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('begin');
    // One draw operation per contest at a time; the unique index on open winners backs this up.
    const result = await work(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    if ((error as { code?: string }).code === '23505') throw new ContestError('Победитель уже выбран. Обновите страницу.');
    throw error;
  } finally { client.release(); }
}

export function drawContestWinner(contest: Contest, adminEmail: string, filters: DrawFilters) {
  // A draw is final for the pool it saw, so it waits until entries close.
  const phase = contestPhase(contest, new Date());
  if (phase === 'open' || phase === 'upcoming') return Promise.reject(new ContestError(`Приём идёт до ${contest.lastDayLabel} включительно — розыгрыш после его окончания.`));
  return transaction(async client => {
    await client.query('select pg_advisory_xact_lock(hashtext($1))', [contest.key]);
    const open = await client.query(`select 1 from "contestDraw" where contest = $1 and status <> 'unreachable'`, [contest.key]);
    if (open.rowCount) throw new ContestError('Победитель уже выбран. Если с ним не связаться — переиграйте.');
    return insertDraw(client, contest, adminEmail, filters);
  });
}

/** The winner did not answer: the draw is closed as unreachable and a new winner is drawn with the same filters. */
export function redrawContestWinner(contest: Contest, adminEmail: string, drawId: string) {
  return transaction(async client => {
    await client.query('select pg_advisory_xact_lock(hashtext($1))', [contest.key]);
    const { rows } = await client.query<{ filters: DrawFilters; winnerId: string | null }>(`update "contestDraw" set status = 'unreachable', "resolvedBy" = $3, "resolvedAt" = now()
      where id = $1 and contest = $2 and status = 'pending' returning filters, "winnerId"`, [drawId, contest.key, adminEmail]);
    if (!rows[0]) throw new ContestError('Этот розыгрыш уже закрыт. Обновите страницу.');
    await audit(client, adminEmail, 'unreachable', `${contest.key}:${rows[0].winnerId ?? 'deleted'}`);
    return insertDraw(client, contest, adminEmail, rows[0].filters);
  });
}

/** The winner answered: the draw is confirmed and, if the contest has one, the secret tag is given. */
export function confirmContestWinner(contest: Contest, adminEmail: string, drawId: string) {
  return transaction(async client => {
    const { rows } = await client.query<{ winnerId: string | null }>(`update "contestDraw" set status = 'confirmed', "resolvedBy" = $3, "resolvedAt" = now()
      where id = $1 and contest = $2 and status = 'pending' returning "winnerId"`, [drawId, contest.key, adminEmail]);
    const winnerId = rows[0]?.winnerId;
    if (!rows[0]) throw new ContestError('Этот розыгрыш уже закрыт. Обновите страницу.');
    if (!winnerId) throw new ContestError('Победитель удалил аккаунт — переиграйте.');
    if (contest.tag) await client.query('insert into "profileAchievement" ("userId", key) values ($1, $2) on conflict do nothing', [winnerId, contest.tag]);
    await audit(client, adminEmail, 'confirm', `${contest.key}:${winnerId}`);
  });
}
