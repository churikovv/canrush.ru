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

const [author, admin, stranger, banned] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
const adminEmail = `${admin}@example.com`;
const brand = `Тест ${randomUUID().slice(0, 6)}`;
const photo = { data: Buffer.from('photo'), thumbnail: Buffer.from('thumb') };
const input = (flavor: string) => ({ brand, flavor, volumes: [450], ingredients: 'Вода' });

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
  const id = await drinks.submitCatalogDrink(author, input('mango'), photo);
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
  expect((await drinks.catalogDrinkGroups()).find(group => group.brand === brand)).toMatchObject({ flavor: 'mango', variants: [], coverImageUrl: `/api/catalog-drinks/${pending!.id}` });
  expect(await drinks.getCatalogDrinkPhoto(pending!.id, null, false)).toMatchObject({ published: true });
  const drink = await drinks.getCatalogDrink(brand, 'mango');
  expect(drinks.catalogDrinkIngredients(drink!)).toMatchObject({ ingredients: 'Вода', status: 'unverified', volumeMl: 450 });
  // Now the published drink itself is the duplicate.
  await expect(drinks.submitCatalogDrink(stranger, input('mango'), photo)).rejects.toThrow('уже есть в каталоге');
});
