import { getPool } from '@/db/pool';

export async function isUserBlocked(userId: string): Promise<boolean> {
  const result = await getPool().query<{ blocked: boolean }>(
    'select exists(select 1 from "userBlock" where "userId" = $1) as blocked',
    [userId],
  );
  return result.rows[0]?.blocked === true;
}
