import type { PoolClient } from 'pg';
import { getPool } from '@/db/pool';
import { DAILY_DAYS, DAILY_ITEMS, dailyReward, dailyTrack, type DailyItem, type DailyReward, type DailyTrack } from '@/lib/daily-reward-fields';
import { moscowDay } from '@/lib/drink-calendar-fields';

type Db = Pick<PoolClient, 'query'>;
const TAG_KEYS = Object.values(DAILY_ITEMS).filter(item => item.kind === 'tag').map(item => item.key);

export interface DailyState {
  today: string; track: DailyTrack;
  /** For a frame drawn on the member's own avatar. */
  avatarId: string | null; username: string | null;
  /** The whole path as this member sees it today: a thing they own shows as the sparks it turns into. */
  rewards: DailyReward[];
}

/** Things of the path the member has: tags as achievements, backgrounds and frames as taken days. */
async function owned(db: Db, userId: string): Promise<Set<string>> {
  const { rows } = await db.query<{ key: string }>(`select key from "profileAchievement" where "userId" = $1 and key = any($2::text[])
    union select item from "dailyReward" where "userId" = $1 and item is not null`, [userId, TAG_KEYS]);
  return new Set(rows.map(row => row.key));
}

async function lastClaim(db: Db, userId: string) {
  return (await db.query<{ day: string; step: number }>(`select day::text as day, step from "dailyReward" where "userId" = $1 order by day desc limit 1`, [userId])).rows[0] ?? null;
}

/** The daily window's state, or `null` for a member blocked by the site (no rewards for them). */
export async function getDailyRewards(userId: string, today = moscowDay()): Promise<DailyState | null> {
  const db = getPool();
  const member = (await db.query<{ username: string | null; avatarId: string | null; blocked: boolean }>(`select u.username, (select id::text from "profileImage" where "userId" = u.id and kind = 'avatar') as "avatarId",
      exists(select 1 from "userBlock" where "userId" = u.id) as blocked from "user" u where u.id = $1`, [userId])).rows[0];
  if (!member || member.blocked) return null;
  const [last, have] = await Promise.all([lastClaim(db, userId), owned(db, userId)]);
  const track = dailyTrack(last, today);
  // Days already taken on this path show what they gave: a thing taken on its day is not «owned before».
  const taken = track.behind + (track.claimed ? 1 : 0);
  const given = new Map((await db.query<{ step: number; item: string | null; xp: number; sparks: number }>(
    `select step, item, xp, sparks from "dailyReward" where "userId" = $1 and day > ($2::date - $3::int) and day <= $2::date`, [userId, today, taken])).rows.map(row => [row.step, row]));
  const rewards = Array.from({ length: DAILY_DAYS }, (_, index) => {
    const step = index + 1, row = step <= taken ? given.get(step) : undefined;
    return row ? { step, xp: row.xp, sparks: row.sparks, item: row.item ? DAILY_ITEMS[step] ?? null : null } : dailyReward(step, key => have.has(key));
  });
  return { today, track, avatarId: member.avatarId, username: member.username, rewards };
}

export type DailyClaimResult = { ok: true; reward: DailyReward; equipped: boolean; track: DailyTrack } | { ok: false; error: string };

/**
 * Takes today's reward once, under the member's lock: the day's row, its XP (journal reason `daily`, the day as the key),
 * and its thing — a tag is an achievement (its own XP comes from the tag trigger), a background or frame is owned through
 * the row. The thing goes on by itself when its place is empty: no tag, the site's background, no frame.
 */
export async function claimDaily(userId: string, today = moscowDay()): Promise<DailyClaimResult> {
  const client = await getPool().connect();
  try {
    await client.query('begin');
    if (!(await client.query('select 1 from "user" where id = $1 for update', [userId])).rowCount) { await client.query('rollback'); return { ok: false, error: 'Профиль не найден. Войдите заново.' }; }
    if ((await client.query('select 1 from "userBlock" where "userId" = $1', [userId])).rowCount) { await client.query('rollback'); return { ok: false, error: 'Награды для этого аккаунта недоступны.' }; }
    const track = dailyTrack(await lastClaim(client, userId), today);
    if (track.claimed) { await client.query('rollback'); return { ok: false, error: 'Сегодняшняя награда уже у вас. Следующая — завтра.' }; }
    const have = await owned(client, userId);
    const reward = dailyReward(track.step, key => have.has(key));
    await client.query('insert into "dailyReward" ("userId", day, step, xp, sparks, item) values ($1, $2, $3, $4, $5, $6)',
      [userId, today, track.step, reward.xp, reward.sparks, reward.item?.key ?? null]);
    if (reward.xp > 0) await client.query(`insert into "profileExperience" ("userId", reason, "sourceKey", points) values ($1, 'daily', $2, $3) on conflict do nothing`, [userId, today, reward.xp]);
    const equipped = reward.item ? await putOn(client, userId, reward.item, true) : false;
    await client.query('commit');
    return { ok: true, reward, equipped, track: { ...track, claimed: true } };
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Puts a thing of the path on: only into an empty place when `onlyEmpty`; returns whether it is on now. */
async function putOn(db: Db, userId: string, item: DailyItem, onlyEmpty: boolean): Promise<boolean> {
  if (item.kind === 'tag') {
    await db.query('insert into "profileAchievement" ("userId", key) values ($1, $2) on conflict do nothing', [userId, item.key]);
    await db.query(`update "user" set "profileTags" = array[$2::text] where id = $1${onlyEmpty ? ' and cardinality("profileTags") = 0' : ''}`, [userId, item.key]);
    return (await db.query<{ on: boolean }>(`select "profileTags"[1] = $2 as on from "user" where id = $1`, [userId, item.key])).rows[0]?.on ?? false;
  }
  const field = item.kind === 'theme' ? 'theme' : 'frame';
  const empty = item.kind === 'theme' ? 'default' : 'none';
  await db.query(`update "user" set "profileAppearance" = jsonb_set("profileAppearance", '{${field}}', to_jsonb($2::text))
    where id = $1${onlyEmpty ? ` and "profileAppearance"->>'${field}' = '${empty}'` : ''}`, [userId, item.key]);
  return (await db.query<{ on: boolean }>(`select "profileAppearance"->>'${field}' = $2 as on from "user" where id = $1`, [userId, item.key])).rows[0]?.on ?? false;
}

/** «Надеть» on the reveal when the place was taken; only a thing the member owns. */
export async function wearDailyItem(userId: string, key: string): Promise<boolean> {
  const item = Object.values(DAILY_ITEMS).find(candidate => candidate.key === key);
  if (!item) return false;
  const db = getPool();
  if (!(await owned(db, userId)).has(key)) return false;
  return putOn(db, userId, item, false);
}
