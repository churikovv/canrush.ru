import type { Pool, PoolClient } from 'pg';
import { getPool } from '@/db/pool';
import { brandFrameProgress, type BrandFrameProgress } from '@/lib/brand-frame-fields';

/**
 * Brand frames open with reviews, not with cans in the tracker: the site is 18+, and a reward for
 * drinking would push to drink. Nothing is stored — the progress is read from the member's reviews,
 * and a frame already worn stays usable (`canUseProfileAppearance`) even if reviews are deleted.
 */
export async function getBrandFrameProgress(userId: string, client: Pool | PoolClient = getPool()): Promise<BrandFrameProgress[]> {
  const { rows } = await client.query<{ brand: string; flavor: string }>('select brand, flavor from review where "userId" = $1', [userId]);
  return brandFrameProgress(rows);
}
