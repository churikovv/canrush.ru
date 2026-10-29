import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Test DB only');
const pool = new Pool({ connectionString: url, max: 4 });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
const brand = `Склейка ${randomUUID().slice(0, 6)}`;
// The catalog the merge may point at: one parser card of the same brand.
vi.mock('../src/lib/store-catalog', () => ({ storeDrinkOptions: async () => [{ brand, flavor: 'mango', label: `${brand} · Манго` }] }));
vi.mock('react', async original => ({ ...await original<typeof import('react')>(), cache: <T,>(fn: T) => fn }));
const { mergeCatalogDrink, searchMergeTargets } = await import('../src/lib/catalog-drink-merge');
const { renamedCatalogDrink } = await import('../src/lib/catalog-drinks');
const { catalogGroupSlug } = await import('../src/lib/catalog-query');
const { getNotifications } = await import('../src/lib/notifications');

const [author, admin, reviewer, stranger] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
const adminEmail = `${admin}@example.com`;
let drinkId = '';
const version = async () => (await pool.query<{ v: Date }>('select "updatedAt" as v from "catalogDrink" where id = $1', [drinkId])).rows[0]!.v.toISOString();

beforeAll(async () => {
  for (const id of [author, admin, reviewer, stranger]) await pool.query(
    `insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt",username) values($1,'Merge test',$2,true,now(),now(),$3)`, [id, `${id}@example.com`, `mg_${id.slice(0, 12)}`]);
  await pool.query('insert into "siteAdmin"(email, role) values($1, \'moderator\')', [adminEmail]);
  // A published member drink (paid 50 XP by its trigger) that turns out to be the parser's mango card.
  drinkId = (await pool.query<{ id: string }>(`insert into "catalogDrink"("ownerId", brand, flavor, volumes, photo, thumbnail, status, "reviewedAt")
    values ($1, $2, 'Огурец', '{450}', 'x', 'x', 'published', now()) returning id`, [author, brand])).rows[0]!.id;
  await pool.query(`insert into review(id,"userId",brand,flavor,design,taste,text,"createdAt","updatedAt") values (gen_random_uuid(),$1,$2,'Огурец',8,8,'Огуречный',now(),now())`, [reviewer, brand]);
});
afterAll(async () => {
  await pool.query('delete from "adminAuditLog" where "adminEmail" = $1', [adminEmail]);
  await pool.query('delete from "catalogDrinkRename" where "fromBrand" = $1', [brand]);
  await pool.query('delete from "catalogCardEdit" where brand = $1', [brand]);
  await pool.query('delete from review where brand = $1', [brand]);
  await pool.query('delete from "siteAdmin" where email = $1', [adminEmail]);
  await pool.query('delete from "user" where id = any($1::text[])', [[author, admin, reviewer, stranger]]);
  await pool.end();
});

it('finds catalog cards to merge into, leaving the drink itself out', async () => {
  expect((await searchMergeTargets('манго')).map(option => option.flavor)).toEqual(['mango']);
  expect(await searchMergeTargets('манго', { brand, flavor: 'mango' })).toEqual([]);
  expect(await searchMergeTargets('')).toEqual([]);
});

it('merges a duplicate into the catalog card, takes back its XP and tells the author', async () => {
  const xp = async () => (await pool.query(`select count(*)::int as n from "profileExperience" where "userId" = $1 and reason = 'catalog-drink'`, [author])).rows[0].n;
  expect(await xp()).toBe(1);
  // Only staff, only onto a card the catalog has.
  await expect(mergeCatalogDrink(stranger, `${stranger}@example.com`, drinkId, await version(), { brand, flavor: 'mango' }, true)).rejects.toThrow('Обновите');
  await expect(mergeCatalogDrink(admin, adminEmail, drinkId, await version(), { brand, flavor: 'melon' }, true)).rejects.toThrow('нет в каталоге');
  const oldSlug = catalogGroupSlug(brand, 'Огурец');
  expect(await mergeCatalogDrink(admin, adminEmail, drinkId, await version(), { brand, flavor: 'mango' }, true)).toEqual({ moved: true, revokedXp: 50 });
  expect((await pool.query('select 1 from "catalogDrink" where id = $1', [drinkId])).rowCount).toBe(0);
  expect((await pool.query(`select flavor from review where "userId" = $1 and brand = $2`, [reviewer, brand])).rows).toEqual([{ flavor: 'mango' }]);
  expect(await xp()).toBe(0);
  expect(await renamedCatalogDrink(oldSlug)).toEqual({ brand, flavor: 'mango' });
  const { items } = await getNotifications(author);
  expect(items[0]).toMatchObject({ kind: 'drink-merged', title: `Ваш напиток «${brand} · Огурец» объединён с карточкой каталога`, detail: `Это ${brand} · Манго · объём 450 мл — в карточке · отзывы и отметки перенесены · −50 XP за дубль` });
  expect((await pool.query(`select action from "adminAuditLog" where "targetId" = $1`, [drinkId])).rows).toEqual([{ action: 'catalog-drink-merge-revoke-xp' }]);
});

it('keeps the XP when the box is cleared, and merges a request without moving anything', async () => {
  const id = (await pool.query<{ id: string }>(`insert into "catalogDrink"("ownerId", brand, flavor, volumes, photo, thumbnail)
    values ($1, $2, 'Дыня', '{450}', 'x', 'x') returning id`, [author, brand])).rows[0]!.id;
  const v = (await pool.query<{ v: Date }>('select "updatedAt" as v from "catalogDrink" where id = $1', [id])).rows[0]!.v.toISOString();
  expect(await mergeCatalogDrink(admin, adminEmail, id, v, { brand, flavor: 'mango' }, false)).toEqual({ moved: false, revokedXp: 0 });
  expect((await pool.query('select 1 from "catalogDrink" where id = $1', [id])).rowCount).toBe(0);
  expect((await getNotifications(author)).items[0]).toMatchObject({ kind: 'drink-merged', detail: `Это ${brand} · Манго · объём 450 мл — в карточке` });
});

it('adds a request for the same drink in another can to the card instead of refusing it', async () => {
  const request = async (volumes: string) => {
    const id = (await pool.query<{ id: string }>(`insert into "catalogDrink"("ownerId", brand, flavor, volumes, photo, thumbnail)
      values ($1, $2, 'mango', $3, 'x', 'x') returning id`, [author, brand, volumes])).rows[0]!.id;
    return { id, v: (await pool.query<{ v: Date }>('select "updatedAt" as v from "catalogDrink" where id = $1', [id])).rows[0]!.v.toISOString() };
  };
  const card = async () => (await pool.query<{ volumes: number[] }>('select volumes from "catalogCardEdit" where brand = $1 and flavor = $2', [brand, 'mango'])).rows[0]?.volumes;
  const first = await request('{330}');
  expect(await mergeCatalogDrink(admin, adminEmail, first.id, first.v, { brand, flavor: 'mango' }, false)).toEqual({ moved: false, revokedXp: 0 });
  expect((await pool.query('select 1 from "catalogDrink" where id = $1', [first.id])).rowCount).toBe(0);
  // The earlier merges into this card left 450 ml; the request adds 330, sorted, without repeats.
  expect(await card()).toEqual([330, 450]);
  expect((await getNotifications(author)).items[0]).toMatchObject({ kind: 'drink-merged', title: `Ваш напиток «${brand} · Манго» уже есть в каталоге`, detail: 'объём 330 мл — в карточке' });
  const second = await request('{330,1000}');
  await mergeCatalogDrink(admin, adminEmail, second.id, second.v, { brand, flavor: 'mango' }, false);
  expect(await card()).toEqual([330, 450, 1000]);
});
