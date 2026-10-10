import { getPool } from '@/db/pool';
import type { Experience } from '@/lib/experience-level';
export async function getExperience(usernames: string[]) {
  const rows = await getPool().query<Experience & { username: string }>(`with population as (select username,xp,rank,rank() over(order by xp) as ascending_rank,count(*) over() as total from "profileRanking") select username,xp,rank,coalesce(floor(100.0*(ascending_rank-1)/nullif(total-1,0))::int,0) as "aheadPercent" from population where username=any($1::text[])`, [usernames]);
  return Object.fromEntries(rows.rows.map(row => [row.username, { xp: row.xp, aheadPercent: row.aheadPercent, rank: row.xp ? row.rank : null }]));
}
export async function getLeaderboard() {
  return (await getPool().query<{ username: string; name: string; xp: number; rank: number; avatarId: string | null }>(`select r.*, (select id::text from "profileImage" where "userId"=r.id and kind='avatar') as "avatarId" from "profileRanking" r where xp > 0 order by xp desc, username limit 100`)).rows;
}
