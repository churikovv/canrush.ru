import { getPool } from '@/db/pool';
import { marketOpen, marketOpenFor } from '@/lib/market-open';

/** A minute: the home page and the header ask on every visit, and a new listing may wait that long for its links. */
const TTL_MS = 60_000;
let cached: { at: number; shown: boolean } | null = null;

/**
 * Whether the market has anything to show — one open listing everyone can see in the current mode (while only companies
 * sell, one of an approved company), with the same rules as the market's own list (`getListings`). Without one the
 * home page's «Маркет» icon and the header's «Объявления» stay away: an empty market is a dead end.
 */
export async function marketHasListings(now = Date.now()): Promise<boolean> {
  if (!marketOpen()) return false;
  if (cached && now - cached.at < TTL_MS) return cached.shown;
  const { rows } = await getPool().query<{ shown: boolean }>(
    `select exists(select 1 from "marketListing" l left join business b on b.id = l."businessId" and b.status = 'approved'
       where l."deletedAt" is null and not l.closed and not exists(select 1 from "userBlock" ub where ub."userId" = l."sellerId")
         and ($1::boolean or b.id is not null)) as shown`, [marketOpenFor('member')]);
  cached = { at: now, shown: rows[0]?.shown === true };
  return cached.shown;
}
