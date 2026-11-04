import { getPool } from '@/db/pool';

export { BETA_ENGINE_PLACES } from '@/lib/beta-engine-fields';

export interface BetaEngine {
  /** Numbers handed out so far; a deleted account keeps its number, so this never goes down. */
  taken: number;
  /** The viewer's own number, if they have one. */
  number: number | null;
  /** The viewer's username, for the link to their achievements. */
  username: string | null;
}

export async function getBetaEngine(userId: string | null): Promise<BetaEngine> {
  const { rows } = await getPool().query<BetaEngine>(`select (select count(*)::int from "betaEngine") as taken,
    (select number from "betaEngine" where "userId" = $1) as number,
    (select username from "user" where id = $1) as username`, [userId]);
  return rows[0] ?? { taken: 0, number: null, username: null };
}

export interface EngineCrewMember { number: number; username: string; avatarId: string | null }

/** The latest numbers, newest first, for the crew rail on /engine: members with a username, not blocked by the site. */
export async function getEngineCrew(limit = 24): Promise<EngineCrewMember[]> {
  const { rows } = await getPool().query<EngineCrewMember>(`select e.number, u.username,
      (select id::text from "profileImage" where "userId" = u.id and kind = 'avatar') as "avatarId"
    from "betaEngine" e join "user" u on u.id = e."userId"
    where u.username is not null and not exists (select 1 from "userBlock" b where b."userId" = u.id)
    order by e.number desc limit $1`, [limit]);
  return rows;
}
