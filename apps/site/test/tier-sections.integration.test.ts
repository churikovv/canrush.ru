import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Test DB only');
const pool = new Pool({ connectionString: url, max: 2 });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
const { getTierListBySlug, getTierListsForOwner, tierForScore } = await import('../src/lib/tier-lists');
const user = randomUUID(), slug = `tier-${randomUUID()}`;
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));
vi.mock('../src/lib/auth', () => ({ auth: { api: { getSession: async () => ({ user: { id: user } }) } } }));
vi.mock('../src/lib/profile', () => ({ ensureOwnProfile: async () => ({ username: 'tier_test' }) }));
vi.mock('../src/lib/profile-community', () => ({ getProfileCommunity: vi.fn() }));
vi.mock('../src/lib/catalog', () => ({ loadTierPickerGroups: async () => [{ brand: 'Burn', flavor: 'original' }, { brand: 'Test', flavor: 'original' }] }));
const { saveTierListAction } = await import('../src/app/tierlists/actions');
beforeAll(async () => {
  await pool.query(`insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt") values($1,'Tier test',$2,true,now(),now())`, [user, user + '@example.com']);
});
afterAll(async () => { await pool.query('delete from "user" where id=$1', [user]); await pool.end(); });
it('preserves legacy defaults, reads reordered and empty sections, and accepts SS placements', async () => {
  const { rows } = await pool.query(`insert into "tierList" ("userId",slug,title) values($1,$2,'Sections') returning id`, [user, slug]);
  expect((await getTierListBySlug(slug))?.tiers).toEqual(['S', 'A', 'B', 'C', 'D']);
  const id = rows[0].id;
  await pool.query(`update "tierList" set tiers=$2 where id=$1`, [id, ['B','SS','S']]);
  await pool.query(`insert into "tierListItem" ("tierListId",brand,flavor,tier,position) values($1,'Burn','original','SS',0),($1,'Test','original','B',0)`, [id]);
  const list = await getTierListBySlug(slug);
  expect(list?.tiers).toEqual(['SS','S','B']);
  expect(list?.items).toHaveLength(2);
  const summary = (await getTierListsForOwner(user))[0]!;
  expect(summary.tiers).toEqual(['SS','S','B']);
  expect(summary.preview.map(item => item.tier)).toEqual(['SS','B']);
});
it('uses ten-point thresholds for the official rating', () => {
  expect([10, 9, 8.99, 8, 7.99, 7, 6.99, 6, 5.99, 5, 4.99, 0].map(tierForScore)).toEqual(['SS','SS','S','S','A','A','B','B','C','C','D','D']);
});

it('saves custom sections through the action and rejects placements in removed sections', async () => {
  const form = new FormData();
  form.set('slug', slug); form.set('title', 'Updated'); form.set('tiers', '["SS","B"]');
  form.set('reactionsEnabled', 'false'); form.set('commentsEnabled', 'true');
  form.set('items', '[{"brand":"Burn","flavor":"original","tier":"SS","position":7}]');
  await expect(saveTierListAction({}, form)).rejects.toThrow('REDIRECT:');
  const saved = await getTierListBySlug(slug);
  expect(saved?.tiers).toEqual(['SS','B']);
  expect(saved).toMatchObject({ reactionsEnabled: false, commentsEnabled: true });
  expect(saved?.items).toEqual([{ brand: 'Burn', flavor: 'original', tier: 'SS', position: 0 }]);
  form.set('tiers', '["B"]');
  expect((await saveTierListAction({}, form)).status).toBe('error');
  expect((await getTierListBySlug(slug))?.tiers).toEqual(['SS','B']);
  form.set('slug', ''); form.set('tiers', '["B","SS"]');
  await expect(saveTierListAction({}, form)).rejects.toThrow('REDIRECT:');
  expect((await getTierListsForOwner(user))[0]?.tiers).toEqual(['SS','B']);
});
