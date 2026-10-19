import { getPool } from '@/db/pool';

/** Places in "betaEngine" (migration 0073): members get them on sign-up, in order, with the "engine" tag. */
export const BETA_ENGINE_PLACES = 500;

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
