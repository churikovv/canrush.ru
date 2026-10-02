import { getPool } from '@/db/pool';
import type { Experience } from '@/lib/experience-level';
export async function getExperience(usernames: string[]) {
  const rows = await getPool().query<Experience & { username: string }>('select username, xp, rank from "profileRanking" where username = any($1::text[])', [usernames]);
  return Object.fromEntries(rows.rows.map(row => [row.username, { xp: row.xp, rank: row.xp ? row.rank : null }]));
}
export async function getLeaderboard() {
  return (await getPool().query<{ username: string; name: string; xp: number; rank: number; avatarId: string | null }>(`select r.*, (select id::text from "profileImage" where "userId"=r.id and kind='avatar') as "avatarId" from "profileRanking" r where xp > 0 order by xp desc, username limit 100`)).rows;
}
