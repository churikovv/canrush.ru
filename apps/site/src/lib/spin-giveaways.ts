import type { PoolClient } from 'pg';
import { getPool } from '@/db/pool';
import type { GiveawayInput } from '@/lib/spin-giveaway-fields';

export class GiveawayError extends Error {}

export interface FeedGiveaway { id: string; title: string; body: string; spins: number; viewSeconds: number; /** Уже получена этим участником */ taken: boolean }
export interface GiveawayRow extends Omit<FeedGiveaway, 'taken'> {
  maxClaims: number | null; claimed: number; seen: number; startsAt: Date; endsAt: Date; endedAt: Date | null; adminEmail: string;
}

/** Running now and still has spins to give. */
const LIVE = `g."startsAt" <= now() and g."endsAt" > now() and g."endedAt" is null and (g."maxClaims" is null or g.claimed < g."maxClaims")`;

/**
 * The banner for this viewer: the oldest running giveaway they have not claimed. One claimed in the last minutes stays,
 * so a re-render after the claim does not take the banner away from under the reward. Blocked members see none.
 */
export async function getFeedGiveaway(viewerId: string | null): Promise<FeedGiveaway | null> {
  const { rows } = await getPool().query<FeedGiveaway>(`select g.id, g.title, g.body, g.spins, g."viewSeconds", v."claimedAt" is not null as taken
    from "spinGiveaway" g left join "spinGiveawayView" v on v."giveawayId" = g.id and v."userId" = $1::text
    where ((${LIVE} and v."claimedAt" is null) or v."claimedAt" > now() - interval '10 minutes')
      and ($1::text is null or not exists(select 1 from "userBlock" b where b."userId" = $1::text))
    order by v."claimedAt" is not null desc, g."startsAt", g.id limit 1`, [viewerId]);
  return rows[0] ?? null;
}

/**
 * The first look at the banner: the server's own clock starts here and a repeat keeps the first moment. Returns the
 * seconds since then, or null when the giveaway is no longer running.
 */
export async function markGiveawaySeen(giveawayId: string, userId: string): Promise<number | null> {
  const pool = getPool();
  await pool.query(`insert into "spinGiveawayView" ("giveawayId", "userId")
    select g.id, $2 from "spinGiveaway" g where g.id = $1 and ${LIVE} on conflict do nothing`, [giveawayId, userId]);
  const { rows } = await pool.query<{ elapsed: number }>(`select extract(epoch from now() - v."seenAt")::float8 as elapsed
    from "spinGiveawayView" v join "spinGiveaway" g on g.id = v."giveawayId" where v."giveawayId" = $1 and v."userId" = $2 and ${LIVE}`, [giveawayId, userId]);
  return rows[0]?.elapsed ?? null;
}

/**
 * Hands out the spins once. The view row is the proof: it must be old enough, and flipping `claimedAt` makes a repeat a
 * no-op that still answers with the spins, so a second tab or a stale page shows the same result. The limit is taken by
 * one atomic update, so it cannot be overrun.
 */
export async function claimGiveaway(giveawayId: string, userId: string): Promise<{ spins: number; balance: number }> {
  const client = await getPool().connect();
  try {
    await client.query('begin');
    if ((await client.query('select 1 from "userBlock" where "userId" = $1', [userId])).rowCount) throw new GiveawayError('Аккаунт заблокирован.');
    const view = (await client.query<{ claimed: boolean; ready: boolean; spins: number }>(`select v."claimedAt" is not null as claimed, g.spins,
        v."seenAt" <= now() - make_interval(secs => g."viewSeconds") as ready
      from "spinGiveawayView" v join "spinGiveaway" g on g.id = v."giveawayId"
      where v."giveawayId" = $1 and v."userId" = $2 for update of v`, [giveawayId, userId])).rows[0];
    if (!view) throw new GiveawayError('Сначала посмотрите баннер.');
    if (!view.claimed) {
      if (!view.ready) throw new GiveawayError('Ещё пара секунд — баннер досматривается.');
      const taken = await client.query(`update "spinGiveaway" g set claimed = g.claimed + 1 where g.id = $1 and ${LIVE}`, [giveawayId]);
      if (!taken.rowCount) throw new GiveawayError('Раздача закончилась.');
      await client.query('update "spinGiveawayView" set "claimedAt" = now() where "giveawayId" = $1 and "userId" = $2', [giveawayId, userId]);
      await client.query(`insert into "spinLedger" ("userId", reason, "sourceKey", amount) values ($1, 'giveaway', $2, $3)`, [userId, giveawayId, view.spins]);
    }
    const balance = (await client.query<{ spins: number }>('select coalesce(sum(amount), 0)::int as spins from "spinLedger" where "userId" = $1', [userId])).rows[0]?.spins ?? 0;
    await client.query('commit');
    return { spins: view.spins, balance };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function listGiveaways(limit = 30): Promise<GiveawayRow[]> {
  const { rows } = await getPool().query<GiveawayRow>(`select g.id, g.title, g.body, g.spins, g."viewSeconds", g."maxClaims", g.claimed, g."startsAt", g."endsAt", g."endedAt", g."adminEmail",
      (select count(*)::int from "spinGiveawayView" v where v."giveawayId" = g.id) as seen
    from "spinGiveaway" g order by g."createdAt" desc limit $1`, [limit]);
  return rows;
}

async function audited<T>(adminEmail: string, action: string, work: (client: PoolClient) => Promise<{ result: T; target: string }>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('begin');
    const { result, target } = await work(client);
    await client.query(`insert into "adminAuditLog" ("adminEmail", action, "targetType", "targetId") values ($1, $2, 'spin-giveaway', $3)`, [adminEmail, action, target]);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function createGiveaway(input: GiveawayInput, adminEmail: string): Promise<string> {
  if (input.endsAt.getTime() <= Date.now()) throw new GiveawayError('Срок раздачи уже прошёл.');
  return audited(adminEmail, 'spin-giveaway', async client => {
    const { rows: [row] } = await client.query<{ id: string }>(`insert into "spinGiveaway" (title, body, spins, "viewSeconds", "maxClaims", "startsAt", "endsAt", "adminEmail")
      values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`, [input.title, input.body, input.spins, input.viewSeconds, input.maxClaims, input.startsAt, input.endsAt, adminEmail]);
    return { result: row!.id, target: row!.id };
  });
}

/** Stops a giveaway early. What members already took stays with them. */
export function stopGiveaway(id: string, adminEmail: string): Promise<void> {
  return audited(adminEmail, 'spin-giveaway-stop', async client => {
    const { rowCount } = await client.query(`update "spinGiveaway" set "endedAt" = now() where id = $1 and "endedAt" is null and "endsAt" > now()`, [id]);
    if (!rowCount) throw new GiveawayError('Раздача уже закончилась.');
    return { result: undefined, target: id };
  });
}
