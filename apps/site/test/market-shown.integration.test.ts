import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Test DB only');
const pool = new Pool({ connectionString: url, max: 2 });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
// Only companies sell (`business`), as on the site since November 2026.
vi.mock('../src/lib/market-mode', () => ({ MARKET_MODE: 'business' }));
const { marketHasListings } = await import('../src/lib/market-shown');

const [seller, owner] = [randomUUID(), randomUUID()];
let companyId = '';
// Listings of other tests may sit in the shared test database: each check looks at a moment far apart (no cache) and
// at the listings this test owns, closing them all at the end.
const at = (() => { let now = Date.now(); return () => (now += 120_000); })();
const others = async () => (await pool.query(`select count(*)::int as count from "marketListing" l left join business b on b.id = l."businessId" and b.status = 'approved'
  where l."deletedAt" is null and not l.closed and b.id is not null and l."sellerId" not in ($1, $2)`, [seller, owner])).rows[0]!.count;

beforeAll(async () => {
  for (const id of [seller, owner]) await pool.query(`insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt",username) values($1,'Маркет',$2,true,now(),now(),$3)`, [id, `${id}@example.com`, `mk_${id.slice(0, 12)}`]);
  companyId = (await pool.query<{ id: string }>(`insert into business ("ownerId", name, kind, status) values ($1, 'Маркет Лаб', 'brand', 'approved') returning id`, [owner])).rows[0]!.id;
});

afterAll(async () => {
  await pool.query('delete from "marketListing" where "sellerId" = any($1::text[])', [[seller, owner]]);
  await pool.query('delete from business where id = $1', [companyId]);
  await pool.query('delete from "user" where id = any($1::text[])', [[seller, owner]]);
  await pool.end();
});

it('counts only a listing everyone can see in the current mode', async () => {
  if (await others()) return; // another test's company listing is open: the answer is «yes» whatever this test does
  expect(await marketHasListings(at())).toBe(false);
  // A personal listing is hidden while only companies sell.
  await pool.query(`insert into "marketListing"("sellerId", title, description, city, price, delivery) values ($1, 'Банка', 'Описание', 'Москва', 10000, '{pickup}')`, [seller]);
  expect(await marketHasListings(at())).toBe(false);
  const { rows: [listing] } = await pool.query<{ id: string }>(`insert into "marketListing"("sellerId", title, description, city, price, delivery, "businessId") values ($1, 'Коробка', 'Описание', 'Москва', 10000, '{pickup}', $2) returning id`, [owner, companyId]);
  expect(await marketHasListings(at())).toBe(true);
  // Cached for a minute: a closed listing shows up a minute later.
  await pool.query('update "marketListing" set closed = true where id = $1', [listing!.id]);
  const now = at();
  expect(await marketHasListings(now - 120_000 + 30_000)).toBe(true);
  expect(await marketHasListings(now)).toBe(false);
});
