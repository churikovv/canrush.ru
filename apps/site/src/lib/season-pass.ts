import { getPool } from '@/db/pool';
import { moscowDay } from '@/lib/drink-calendar-fields';
import { PASS_EXCLUDED_REASONS, PASS_LEVELS, passClaimable, passLevelReached, passProgress, type PassRewardKind } from '@/lib/season-fields';

export class SeasonPassError extends Error {}

interface Queryable { query: ReturnType<typeof getPool>['query'] }

export interface PassLevelView { level: number; points: number; kind: PassRewardKind; amount: number; reached: boolean; claimed: boolean }
export interface SeasonPassView { season: string; points: number; reached: number; ready: number; progress: ReturnType<typeof passProgress>; levels: PassLevelView[] }

const LEDGERS: Record<PassRewardKind, string> = { caps: 'capLedger', shards: 'shardLedger', spins: 'spinLedger', rings: 'ringLedger' };

async function seasonPoints(db: Queryable, userId: string, season: string) {
  return (await db.query<{ points: number }>(`select coalesce(sum(points), 0)::int as points from "profileExperience"
    where "userId" = $1 and reason <> all($2::text[]) and "createdAt" <@ monthly_top_bounds($3::date)`, [userId, PASS_EXCLUDED_REASONS, `${season}-01`])).rows[0]?.points ?? 0;
}

async function claimedLevels(db: Queryable, userId: string, season: string) {
  return new Set((await db.query<{ level: number }>('select level from "seasonPassClaim" where "userId" = $1 and season = $2', [userId, season])).rows.map(row => row.level));
}

function view(season: string, points: number, claimed: ReadonlySet<number>): SeasonPassView {
  const reached = passLevelReached(points);
  return {
    season, points, reached, ready: passClaimable(points, claimed).length, progress: passProgress(points),
    levels: PASS_LEVELS.map((level, index) => ({ ...level, level: index + 1, reached: index < reached, claimed: claimed.has(index + 1) })),
  };
}

/** Пропуск текущего сезона; гостю — те же уровни без прогресса. */
export async function getSeasonPass(userId: string | null, now = Date.now()): Promise<SeasonPassView> {
  const season = moscowDay(new Date(now)).slice(0, 7);
  if (!userId) return view(season, 0, new Set());
  const db = getPool();
  const [points, claimed] = await Promise.all([seasonPoints(db, userId, season), claimedLevels(db, userId, season)]);
  return view(season, points, claimed);
}

/**
 * Забрать все достигнутые уровни разом. Одна транзакция под блокировкой участника: строка `seasonPassClaim` не даёт забрать
 * уровень дважды, а сама награда ложится в журнал своей валюты. Незабранное сгорает вместе с сезоном.
 */
export async function claimSeasonPass(userId: string, now = Date.now()): Promise<{ claimed: { kind: PassRewardKind; amount: number }[]; pass: SeasonPassView }> {
  const season = moscowDay(new Date(now)).slice(0, 7);
  const client = await getPool().connect();
  try {
    await client.query('begin');
    await client.query('select 1 from "user" where id = $1 for no key update', [userId]);
    if ((await client.query('select 1 from "userBlock" where "userId" = $1', [userId])).rowCount) throw new SeasonPassError('Аккаунт заблокирован.');
    const points = await seasonPoints(client, userId, season);
    const claimed = await claimedLevels(client, userId, season);
    const levels = passClaimable(points, claimed);
    if (!levels.length) throw new SeasonPassError('Новых наград пока нет.');
    for (const level of levels) {
      await client.query('insert into "seasonPassClaim"("userId", season, level) values ($1, $2, $3)', [userId, season, level.level]);
      await client.query(`insert into "${LEDGERS[level.kind]}"("userId", reason, "sourceKey", amount) values ($1, 'pass', $2, $3)`, [userId, `${season}:${level.level}`, level.amount]);
      claimed.add(level.level);
    }
    await client.query('commit');
    return { claimed: levels.map(({ kind, amount }) => ({ kind, amount })), pass: view(season, points, claimed) };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
