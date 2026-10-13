import { getPool } from '@/db/pool';
import type { profileCompatibility } from './profile-compatibility';
export type CompatibilityTrend = { delta: number | null; reason: 'ready' | 'history' | 'criteria' | 'data' };
export async function recordCompatibility(viewerId: string, profileId: string, value: ReturnType<typeof profileCompatibility>): Promise<CompatibilityTrend> {
  if (value.score === null || viewerId === profileId) return { delta: null, reason: 'data' };
  const criteria = value.parts.map(part => part.score === null ? '0' : '1').join('');
  const db = await getPool().connect();
  try {
    await db.query('begin');
    // Use the database collation, matching the table's ordering constraint.
    const pair = await db.query<{low:string;high:string}>('select least($1::text,$2::text) as low, greatest($1::text,$2::text) as high',[viewerId,profileId]);
    const {low,high} = pair.rows[0]!;
    await db.query(`insert into "profileCompatibilitySnapshot"("userLow","userHigh",score,criteria,parts)
      values($1,$2,$3,$4,$5) on conflict("userLow","userHigh",day) do update set score=excluded.score,criteria=excluded.criteria,parts=excluded.parts
      where ("profileCompatibilitySnapshot".score,"profileCompatibilitySnapshot".criteria,"profileCompatibilitySnapshot".parts) is distinct from (excluded.score,excluded.criteria,excluded.parts)`,
      [low, high, value.score, criteria, JSON.stringify(value.parts)]);
    // A snapshot up to seven days before the month boundary is an acceptable baseline.
    const baseline = await db.query<{score:number;criteria:string}>(`select score,criteria from "profileCompatibilitySnapshot" where "userLow"=$1 and "userHigh"=$2
      and day between (now() at time zone 'Europe/Moscow')::date-37 and (now() at time zone 'Europe/Moscow')::date-30 order by day desc limit 1`, [low, high]);
    await db.query(`delete from "profileCompatibilitySnapshot" where "userLow"=$1 and "userHigh"=$2 and day<(now() at time zone 'Europe/Moscow')::date-90`,[low,high]);
    await db.query('commit');
    const previous = baseline.rows[0];
    if (!previous) return {delta:null,reason:'history'};
    if (previous.criteria !== criteria) return {delta:null,reason:'criteria'};
    return {delta:value.score-previous.score,reason:'ready'};
  } catch(error) { await db.query('rollback'); throw error; }
  finally { db.release(); }
}
