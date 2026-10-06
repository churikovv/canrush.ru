import { getPool } from '@/db/pool';
import { reportReason } from './profile-report-fields';

export async function createProfileReport(userId: string, targetId: string, reason: string, comment: string): Promise<'sent' | 'duplicate' | 'limited' | 'invalid'> {
  if (!targetId || targetId.length > 160 || userId === targetId || !reportReason(reason) || comment.length > 1000) return 'invalid';
  const client = await getPool().connect();
  try {
    await client.query('begin');
    // Serialize submissions per reporter so simultaneous requests cannot bypass the limit.
    const actor = await client.query('select id from "user" where id=$1 for no key update', [userId]);
    if (!actor.rowCount || !(await client.query('select id from "user" where id=$1', [targetId])).rowCount) {
      await client.query('rollback'); return 'invalid';
    }
    if ((await client.query('select 1 from "profileReport" where "userId"=$1 and "targetId"=$2 and status=\'open\'', [userId,targetId])).rowCount) {
      await client.query('rollback'); return 'duplicate';
    }
    const count = await client.query<{ count: number }>('select count(*)::int as count from "profileReport" where "userId"=$1 and "createdAt">now()-interval \'24 hours\'', [userId]);
    if ((count.rows[0]?.count ?? 0) >= 10) { await client.query('rollback'); return 'limited'; }
    await client.query('insert into "profileReport" ("userId","targetId",reason,comment) values ($1,$2,$3,$4)', [userId,targetId,reason,comment.trim()]);
    await client.query('commit'); return 'sent';
  } catch (error) { await client.query('rollback'); throw error; }
  finally { client.release(); }
}
