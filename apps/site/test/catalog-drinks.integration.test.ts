import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Test DB only');
const pool = new Pool({ connectionString: url, max: 4 });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
// The parser's files: one known drink to collide with.
vi.mock('../src/lib/catalog-files', () => ({ readAllCatalogGroups: async () => [{ brand: 'Файлбренд', flavor: 'apple', variants: [], minPrice: 0 }] }));
// React's request cache would keep the first published list for the whole test file.
vi.mock('react', async original => ({ ...await original<typeof import('react')>(), cache: <T,>(fn: T) => fn }));
const drinks = await import('../src/lib/catalog-drinks');
const { matchesCatalogQuery } = await import('../src/lib/catalog-query');

const [author, admin, stranger, banned] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
const adminEmail = `${admin}@example.com`;
const brand = `Тест ${randomUUID().slice(0, 6)}`;
const photo = { data: Buffer.from('photo'), thumbnail: Buffer.from('thumb') };
const input = (flavor: string, fullName = '') => ({ brand, flavor, fullName, volumes: [450], ingredients: 'Вода' });

beforeAll(async () => {
  for (const id of [author, admin, stranger, banned]) await pool.query(
    `insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt",username) values($1,'Drinks test',$2,true,now(),now(),$3)`, [id, `${id}@example.com`, `cd_${id.slice(0, 12)}`]);
  await pool.query('insert into "siteAdmin"(email) values($1)', [adminEmail]);
  await pool.query('insert into "userBlock"("userId") values($1)', [banned]);
});
afterAll(async () => {
  await pool.query('delete from "siteAdmin" where email = $1', [adminEmail]);
  await pool.query('delete from "user" where id = any($1::text[])', [[author, admin, stranger, banned]]);
  await pool.end();
});

it('sends a drink for moderation, refuses duplicates and blocked accounts', async () => {
  await expect(drinks.submitCatalogDrink(author, { ...input('apple'), brand: 'файлбренд' }, photo)).rejects.toMatchObject({ href: expect.stringMatching(/^\/catalog\//u) });
  await expect(drinks.submitCatalogDrink(author, input('mango'), undefined)).rejects.toThrow('фото');
  await expect(drinks.submitCatalogDrink(banned, input('mango'), photo)).rejects.toThrow('ограничено');
  const id = await drinks.submitCatalogDrink(author, input('mango', 'Тест Ultra Paradise'), photo);
  expect((await drinks.listOwnCatalogDrinks(author)).map(drink => [drink.id, drink.status, drink.name])).toEqual([[id, 'pending', 'Манго']]);
  // The minute between requests, then the live request itself, stop a second one.
  await expect(drinks.submitCatalogDrink(author, input('kiwi'), photo)).rejects.toThrow('минуту');
  await pool.query(`update "catalogDrink" set "createdAt" = now() - interval '2 minutes' where id = $1`, [id]);
  await expect(drinks.submitCatalogDrink(author, input('mango'), photo)).rejects.toThrow('ждёт проверки');
});

it('publishes after moderation into the catalog, with the photo public only then', async () => {
  const [pending] = (await drinks.listPendingCatalogDrinks()).items.filter(drink => drink.brand === brand);
  expect(pending).toBeDefined();
  expect(await drinks.getCatalogDrinkPhoto(pending!.id, stranger, false)).toBeNull();
  expect(await drinks.getCatalogDrinkPhoto(pending!.id, author, true)).toMatchObject({ published: false });
  expect((await drinks.catalogDrinkGroups()).some(group => group.brand === brand)).toBe(false);
  await expect(drinks.moderateCatalogDrink(stranger, pending!.id, 'published', '', pending!.updatedAt.toISOString())).rejects.toThrow('Обновите');
  await expect(drinks.moderateCatalogDrink(admin, pending!.id, 'rejected', '', pending!.updatedAt.toISOString())).rejects.toThrow('причину');
  await drinks.moderateCatalogDrink(admin, pending!.id, 'published', '', pending!.updatedAt.toISOString());
  const group = (await drinks.catalogDrinkGroups()).find(group => group.brand === brand);
  expect(group).toMatchObject({ flavor: 'mango', variants: [], coverImageUrl: expect.stringMatching(new RegExp(`^/api/catalog-drinks/${pending!.id}\\?v=\\d+$`)), fullName: 'Тест Ultra Paradise' });
  // Search finds it by the full name as well as by brand and flavour.
  for (const query of ['ultra paradise', 'Paradise', 'манго']) expect(matchesCatalogQuery(group!, query)).toBe(true);
  expect(matchesCatalogQuery(group!, 'zero ultra')).toBe(false);
  expect(await drinks.getCatalogDrinkPhoto(pending!.id, null, false)).toMatchObject({ published: true });
  const drink = await drinks.getCatalogDrink(brand, 'mango');
  expect(drinks.catalogDrinkIngredients(drink!)).toMatchObject({ ingredients: 'Вода', status: 'unverified', volumeMl: 450 });
  // Now the published drink itself is the duplicate.
  await expect(drinks.submitCatalogDrink(stranger, input('mango'), photo)).rejects.toThrow('уже есть в каталоге');
});

it('pays 50 XP per published drink once, lists them for the profile and gives «Сэнсэй» for three', async () => {
  const xp = async () => (await pool.query<{ points: number; count: number }>(`select coalesce(sum(points), 0)::int as points, count(*)::int as count
    from "profileExperience" where "userId" = $1 and reason = 'catalog-drink'`, [author])).rows[0];
  expect(await xp()).toEqual({ points: 50, count: 1 });
  // A second moderation of the same drink does not pay again.
  await pool.query(`update "catalogDrink" set status = 'pending' where "ownerId" = $1`, [author]);
  await pool.query(`update "catalogDrink" set status = 'published' where "ownerId" = $1`, [author]);
  expect(await xp()).toEqual({ points: 50, count: 1 });
  for (const flavor of ['kiwi', 'lime']) await pool.query(`insert into "catalogDrink"("ownerId", brand, flavor, volumes, photo, thumbnail, status)
    values ($1, $2, $3, '{450}', 'x', 'x', 'published')`, [author, brand, flavor]);
  expect(await xp()).toEqual({ points: 150, count: 3 });
  expect(await drinks.listPublishedDrinksByOwner(author)).toMatchObject({ total: 3 });
  const { getProfileCommunity } = await import('../src/lib/profile-community');
  expect((await getProfileCommunity(author)).earned).toContain('sensei');
});

it('lets an admin list, correct, re-photograph and delete drinks, keeping a published identity', async () => {
  const published = (await drinks.listCatalogDrinks('published', 1, 50, brand)).items;
  expect(published.map(drink => drink.flavor).sort()).toEqual(['kiwi', 'lime', 'mango']);
  expect((await drinks.listCatalogDrinks('published', 1, 50, 'Ultra Paradise')).items.map(drink => drink.flavor)).toContain('mango');
  const mango = published.find(drink => drink.flavor === 'mango')!;
  const edit = { fullName: 'Тест Ultra Paradise 2', volumes: [330, 500], ingredients: 'Вода, таурин' };
  // Only an admin, only from the version they saw.
  await expect(drinks.updateCatalogDrink(stranger, `${stranger}@example.com`, mango.id, mango.updatedAt.toISOString(), edit)).rejects.toThrow('Обновите');
  await expect(drinks.updateCatalogDrink(admin, adminEmail, mango.id, '2000-01-01T00:00:00.000Z', edit)).rejects.toThrow('Обновите');
  // A published drink keeps brand and flavour: an identity change is refused.
  await expect(drinks.updateCatalogDrink(admin, adminEmail, mango.id, mango.updatedAt.toISOString(), { ...edit, brand, flavor: 'peach' })).rejects.toThrow('Обновите');
  await drinks.updateCatalogDrink(admin, adminEmail, mango.id, mango.updatedAt.toISOString(), edit, { data: Buffer.from('new photo'), thumbnail: Buffer.from('new thumb') });
  const updated = await drinks.getCatalogDrink(brand, 'mango');
  expect(updated).toMatchObject({ fullName: 'Тест Ultra Paradise 2', volumes: [330, 500], ingredients: 'Вода, таурин' });
  expect(updated!.photo).not.toBe(mango.photo);
  expect((await drinks.getCatalogDrinkPhoto(mango.id, null, false))!.data.toString()).toBe('new photo');
  // A request may still change brand and flavour, checked against the catalog.
  const requestId = (await pool.query<{ id: string }>(`insert into "catalogDrink"("ownerId", brand, flavor, volumes, photo, thumbnail)
    values ($1, $2, 'grape', '{450}', 'x', 'x') returning id`, [stranger, brand])).rows[0]!.id;
  const [request] = (await drinks.listCatalogDrinks('pending', 1, 50, brand)).items.filter(drink => drink.id === requestId);
  await expect(drinks.updateCatalogDrink(admin, adminEmail, requestId, request!.updatedAt.toISOString(), { ...edit, brand, flavor: 'mango' })).rejects.toThrow('уже есть в каталоге');
  await drinks.updateCatalogDrink(admin, adminEmail, requestId, request!.updatedAt.toISOString(), { ...edit, brand, flavor: 'cherry' });
  expect((await pool.query('select flavor from "catalogDrink" where id = $1', [requestId])).rows[0]).toEqual({ flavor: 'cherry' });
  // Deleting takes the drink out of the catalog; the XP already paid stays.
  await expect(drinks.deleteCatalogDrink(stranger, `${stranger}@example.com`, mango.id)).rejects.toThrow('удалён');
  await drinks.deleteCatalogDrink(admin, adminEmail, mango.id);
  expect(await drinks.getCatalogDrink(brand, 'mango')).toBeNull();
  expect((await pool.query(`select count(*)::int as n from "profileExperience" where "userId" = $1 and reason = 'catalog-drink'`, [author])).rows[0]).toEqual({ n: 3 });
  expect((await pool.query(`select action from "adminAuditLog" where "targetId" = $1 order by id`, [mango.id])).rows.map(row => row.action)).toEqual(['catalog-drink-edit-photo', 'catalog-drink-delete']);
  await pool.query(`delete from "adminAuditLog" where "targetType" = 'catalog-drink' and "adminEmail" = $1`, [adminEmail]);
});
