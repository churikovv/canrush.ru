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
  // A parser card is only a warning: the member may send their version with confirmMatch (see the last test).
  await expect(drinks.submitCatalogDrink(author, { ...input('apple'), brand: 'файлбренд' }, photo)).rejects.toMatchObject({ href: expect.stringMatching(/^\/catalog\//u), confirmable: true });
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
  expect(group).toMatchObject({ flavor: 'mango', variants: [], coverImageUrl: expect.stringMatching(new RegExp(`^/api/catalog-drinks/${pending!.id}/\\d+$`)), fullName: 'Тест Ultra Paradise' });
  // Search finds it by the full name as well as by brand and flavour.
  for (const query of ['ultra paradise', 'Paradise', 'манго']) expect(matchesCatalogQuery(group!, query)).toBe(true);
  expect(matchesCatalogQuery(group!, 'zero ultra')).toBe(false);
  expect(await drinks.getCatalogDrinkPhoto(pending!.id, null, false)).toMatchObject({ published: true });
  const drink = await drinks.getCatalogDrink(brand, 'mango');
  expect(drinks.catalogDrinkIngredients(drink!)).toMatchObject({ ingredients: 'Вода', status: 'unverified', volumeMl: 450 });
  // Now the published drink itself is the duplicate — a warning, as with a parser card (see the last tests).
  await expect(drinks.submitCatalogDrink(stranger, input('mango'), photo)).rejects.toMatchObject({ message: expect.stringContaining('другой участник'), confirmable: true });
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

it('lets an admin list, correct, rename, re-photograph and delete drinks', async () => {
  const published = (await drinks.listCatalogDrinks('published', 1, 50, brand)).items;
  expect(published.map(drink => drink.flavor).sort()).toEqual(['kiwi', 'lime', 'mango']);
  expect((await drinks.listCatalogDrinks('published', 1, 50, 'Ultra Paradise')).items.map(drink => drink.flavor)).toContain('mango');
  const mango = published.find(drink => drink.flavor === 'mango')!;
  const edit = { brand, flavor: 'mango', fullName: 'Тест Ultra Paradise 2', volumes: [330, 500], ingredients: 'Вода, таурин' };
  // Only an admin, only from the version they saw.
  await expect(drinks.updateCatalogDrink(stranger, `${stranger}@example.com`, mango.id, mango.updatedAt.toISOString(), edit)).rejects.toThrow('Обновите');
  await expect(drinks.updateCatalogDrink(admin, adminEmail, mango.id, '2000-01-01T00:00:00.000Z', edit)).rejects.toThrow('Обновите');
  // Not onto a drink the catalog already has.
  await expect(drinks.updateCatalogDrink(admin, adminEmail, mango.id, mango.updatedAt.toISOString(), { ...edit, flavor: 'kiwi' })).rejects.toThrow('уже есть в каталоге');
  await drinks.updateCatalogDrink(admin, adminEmail, mango.id, mango.updatedAt.toISOString(), edit, { data: Buffer.from('new photo'), thumbnail: Buffer.from('new thumb') });
  const updated = await drinks.getCatalogDrink(brand, 'mango');
  expect(updated).toMatchObject({ fullName: 'Тест Ultra Paradise 2', volumes: [330, 500], ingredients: 'Вода, таурин' });
  expect(updated!.photo).not.toBe(mango.photo);
  expect((await drinks.getCatalogDrinkPhoto(mango.id, null, false))!.data.toString()).toBe('new photo');

  // Renaming a published drink moves what members left on it; the old address leads to the new one.
  await pool.query(`insert into review(id, "userId", brand, flavor, design, taste, text, "createdAt", "updatedAt") values (gen_random_uuid(), $1, $2, 'mango', 8, 8, 'Отзыв', now(), now())`, [stranger, brand]);
  await pool.query(`insert into "drinkLog"("userId", brand, flavor, name, day) values ($1, $2, 'mango', 'Тест', current_date)`, [stranger, brand]);
  await pool.query(`insert into "drinkSwipe"("userId", brand, flavor, liked) values ($1, $2, 'mango', true)`, [stranger, brand]);
  const { catalogGroupSlug } = await import('../src/lib/catalog-query');
  const oldSlug = catalogGroupSlug(brand, 'mango');
  await drinks.updateCatalogDrink(admin, adminEmail, mango.id, updated!.updatedAt.toISOString(), { ...edit, flavor: 'blend:mango+peach' });
  expect(await drinks.getCatalogDrink(brand, 'mango')).toBeNull();
  expect(await drinks.getCatalogDrink(brand, 'blend:mango+peach')).toMatchObject({ id: mango.id });
  const moved = await pool.query<{ table: string; n: number }>(`select 'review' as table, count(*)::int as n from review where brand = $1 and flavor = 'blend:mango+peach'
    union all select 'drinkLog', count(*)::int from "drinkLog" where brand = $1 and flavor = 'blend:mango+peach'
    union all select 'drinkSwipe', count(*)::int from "drinkSwipe" where brand = $1 and flavor = 'blend:mango+peach'
    union all select 'left', (select count(*)::int from review where brand = $1 and flavor = 'mango') + (select count(*)::int from "drinkLog" where brand = $1 and flavor = 'mango')`, [brand]);
  expect(Object.fromEntries(moved.rows.map(row => [row.table, row.n]))).toEqual({ review: 1, drinkLog: 1, drinkSwipe: 1, left: 0 });
  expect(await drinks.renamedCatalogDrink(oldSlug)).toEqual({ brand, flavor: 'blend:mango+peach' });
  // A second rename keeps the first address pointing at the newest card.
  const renamed = (await drinks.getCatalogDrink(brand, 'blend:mango+peach'))!;
  await drinks.updateCatalogDrink(admin, adminEmail, mango.id, renamed.updatedAt.toISOString(), { ...edit, flavor: 'blend:mango+pear' });
  expect(await drinks.renamedCatalogDrink(oldSlug)).toEqual({ brand, flavor: 'blend:mango+pear' });

  // Deleting takes the drink out of the catalog; the XP already paid stays.
  await expect(drinks.deleteCatalogDrink(stranger, `${stranger}@example.com`, mango.id)).rejects.toThrow('удалён');
  await drinks.deleteCatalogDrink(admin, adminEmail, mango.id);
  expect(await drinks.getCatalogDrink(brand, 'blend:mango+pear')).toBeNull();
  expect((await pool.query(`select count(*)::int as n from "profileExperience" where "userId" = $1 and reason = 'catalog-drink'`, [author])).rows[0]).toEqual({ n: 3 });
  expect((await pool.query(`select action from "adminAuditLog" where "targetId" = $1 order by id`, [mango.id])).rows.map(row => row.action))
    .toEqual(['catalog-drink-edit-photo', 'catalog-drink-rename', 'catalog-drink-rename', 'catalog-drink-delete']);
  await pool.query(`delete from "adminAuditLog" where "targetType" = 'catalog-drink' and "adminEmail" = $1`, [adminEmail]);
  await pool.query(`delete from "catalogDrinkRename" where "fromBrand" = $1`, [brand]);
  await pool.query(`delete from review where brand = $1; `.trim(), [brand]);
  await pool.query(`delete from "drinkLog" where brand = $1`, [brand]);
  await pool.query(`delete from "drinkSwipe" where brand = $1`, [brand]);
});

it('shows everyone the requests waiting for moderation, searchable, without photos', async () => {
  const id = (await pool.query<{ id: string }>(`insert into "catalogDrink"("ownerId", brand, flavor, "fullName", volumes, photo, thumbnail)
    values ($1, $2, 'blend:melon+peach', 'Тест Adder Terror', '{450}', 'x', 'x') returning id`, [stranger, brand])).rows[0]!.id;
  const before = await drinks.countPendingCatalogDrinks();
  expect(before).toBeGreaterThanOrEqual(1);
  const found = await drinks.listPendingCatalogDrinksPublic('adder terror');
  expect(found.items.find(drink => drink.id === id)).toEqual(expect.objectContaining({ brand, name: 'Дыня + Персик', fullName: 'Тест Adder Terror', volumes: [450], author: `cd_${stranger.slice(0, 12)}` }));
  expect(Object.keys(found.items[0]!)).not.toContain('photo');
  // A blocked author's request is not on the list, and neither is a drink once it is published.
  const hidden = (await pool.query<{ id: string }>(`insert into "catalogDrink"("ownerId", brand, flavor, "fullName", volumes, photo, thumbnail)
    values ($1, $2, 'grape', 'Тест Adder Hidden', '{450}', 'x', 'x') returning id`, [banned, brand])).rows[0]!.id;
  expect((await drinks.listPendingCatalogDrinksPublic('adder')).items.map(drink => drink.id)).not.toContain(hidden);
  await pool.query('delete from "catalogDrink" where id = $1', [hidden]);
  await pool.query(`update "catalogDrink" set status = 'published' where id = $1`, [id]);
  expect((await drinks.listPendingCatalogDrinksPublic('adder terror')).items.some(drink => drink.id === id)).toBe(false);
  expect(await drinks.countPendingCatalogDrinks()).toBe(before - 1);
  await pool.query('delete from "catalogDrink" where id = $1', [id]);
});

it('takes a version of a parser card after the warning, but will not publish it under that card', async () => {
  const member = randomUUID();
  await pool.query(`insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt",username) values($1,'Drinks test',$2,true,now(),now(),$3)`, [member, `${member}@example.com`, `cd_${member.slice(0, 12)}`]);
  try {
    const id = await drinks.submitCatalogDrink(member, { ...input('apple'), brand: 'Файлбренд' }, photo, true);
    const [request] = (await drinks.listOwnCatalogDrinks(member)).filter(drink => drink.id === id);
    expect(request).toMatchObject({ brand: 'Файлбренд', flavor: 'apple', status: 'pending' });
    expect(await drinks.catalogFileMatch('файлбренд', 'APPLE')).toMatchObject({ brand: 'Файлбренд' });
    await expect(drinks.moderateCatalogDrink(admin, id, 'published', '', request!.updatedAt.toISOString())).rejects.toThrow('склейте');
    await drinks.moderateCatalogDrink(admin, id, 'rejected', 'Та же банка', request!.updatedAt.toISOString());
  } finally {
    await pool.query('delete from "user" where id = $1', [member]);
  }
});

it("takes another member's version after the warning: one waiting request per member, one published drink per identity", async () => {
  const [first, second] = [randomUUID(), randomUUID()];
  for (const id of [first, second]) await pool.query(`insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt",username) values($1,'Drinks test',$2,true,now(),now(),$3)`, [id, `${id}@example.com`, `cd_${id.slice(0, 12)}`]);
  try {
    const firstId = await drinks.submitCatalogDrink(first, input('pear'), photo);
    // Waiting in another member's request: a warning that links to the public queue.
    await expect(drinks.submitCatalogDrink(second, input('pear'), photo)).rejects.toMatchObject({ href: expect.stringMatching(/^\/catalog\/pending\?q=/u), confirmable: true });
    const secondId = await drinks.submitCatalogDrink(second, input('pear'), photo, true);
    // The member's own waiting request is not sent twice, warning or not.
    await expect(drinks.submitCatalogDrink(second, input('pear'), photo, true)).rejects.toThrow('ждёт проверки');
    const version = async (owner: string, id: string) => (await drinks.listOwnCatalogDrinks(owner)).find(drink => drink.id === id)!.updatedAt.toISOString();
    await drinks.moderateCatalogDrink(admin, firstId, 'published', '', await version(first, firstId));
    await expect(drinks.moderateCatalogDrink(admin, secondId, 'published', '', await version(second, secondId))).rejects.toThrow('уже опубликован');
    // Juice makes it a drink of its own: no warning.
    await pool.query(`update "catalogDrink" set "createdAt" = now() - interval '2 minutes' where "ownerId" = $1`, [second]);
    await expect(drinks.submitCatalogDrink(second, input('pear:juice'), photo)).resolves.toEqual(expect.any(String));
  } finally {
    await pool.query('delete from "user" where id = any($1::text[])', [[first, second]]);
  }
});
