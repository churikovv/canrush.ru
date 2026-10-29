import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Test DB only');
const pool = new Pool({ connectionString: url, max: 3, allowExitOnIdle: true });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
// React's request cache would keep the first list of edits for the whole file.
vi.mock('react', async original => ({ ...await original<typeof import('react')>(), cache: <T,>(fn: T) => fn }));
const brand = `Карточка ${randomUUID().slice(0, 6)}`;
vi.mock('../src/lib/catalog-files', () => ({ readAllCatalogGroups: async () => [
  { brand, flavor: 'black', variants: [{ source: 'edadeal', price: 99, url: 'a' }], minPrice: 99, coverImageUrl: '/black.jpg' },
  { brand, flavor: 'Тропик', variants: [{ source: 'edadeal', price: 79, url: 'b' }], minPrice: 79 },
  { brand, flavor: 'juice', variants: [], minPrice: 0 },
] }));
const edits = await import('../src/lib/catalog-card-edits');
const files = await import('../src/lib/catalog-files');
const checks = await import('../src/lib/catalog-card-check');

const [member, staff] = [randomUUID(), randomUUID()];
const staffEmail = `${staff}@example.com`;
beforeAll(async () => {
  for (const id of [member, staff]) await pool.query(`insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt",username) values($1,'Card test',$2,true,now(),now(),$3)`, [id, `${id}@example.com`, `cc_${id.slice(0, 12)}`]);
  await pool.query(`insert into "siteAdmin"(email, role) values ($1, 'moderator')`, [staffEmail]);
});
afterAll(async () => {
  await pool.query('delete from "catalogCardEdit" where brand = $1', [brand]);
  await pool.query('delete from "catalogDrinkRename" where "fromBrand" = $1', [brand]);
  await pool.query('delete from "adminAuditLog" where "adminEmail" = $1', [staffEmail]);
  await pool.query('delete from "siteAdmin" where email = $1', [staffEmail]);
  await pool.query('delete from "user" where id = any($1::text[])', [[member, staff]]);
  await pool.end();
});

it('merges a parser card into another: offers, reviews and the old address follow; only the team may', async () => {
  await pool.query(`insert into review(id, "userId", brand, flavor, design, taste, text, "createdAt", "updatedAt") values (gen_random_uuid(), $1, $2, 'Тропик', 8, 8, 'Отзыв', now(), now())`, [member, brand]);
  // A price watch hangs on its favourite: the merge must move both (it once failed on the foreign key).
  await pool.query(`insert into favorite("userId", brand, flavor) values ($1, $2, 'Тропик')`, [member, brand]);
  await pool.query(`insert into "favoritePriceWatch"("userId", brand, flavor, city, volume, price, "snapshotAt") values ($1, $2, 'Тропик', 'moscow', 450, 99, now())`, [member, brand]);
  const card = { brand, flavor: 'Тропик' }, target = { brand, flavor: 'black' };
  await expect(edits.mergeCatalogCard(member, `${member}@example.com`, card, target)).rejects.toThrow('Нет доступа');
  await expect(edits.mergeCatalogCard(staff, staffEmail, card, card)).rejects.toThrow('та же карточка');
  await edits.mergeCatalogCard(staff, staffEmail, card, target);
  await expect(edits.mergeCatalogCard(staff, staffEmail, target, card)).rejects.toThrow('уже склеена');
  const shown = await edits.withCardEdits(await files.readAllCatalogGroups());
  expect(shown.filter(group => group.brand === brand).map(group => [group.flavor, group.minPrice, group.variants.length])).toEqual([['black', 79, 2], ['juice', 0, 0]]);
  expect((await pool.query('select flavor from review where "userId" = $1', [member])).rows).toEqual([{ flavor: 'black' }]);
  expect((await pool.query('select flavor from "favoritePriceWatch" where "userId" = $1', [member])).rows).toEqual([{ flavor: 'black' }]);
  expect((await pool.query('select flavor from favorite where "userId" = $1', [member])).rows).toEqual([{ flavor: 'black' }]);
  expect((await pool.query('select "toFlavor" from "catalogDrinkRename" where "fromBrand" = $1', [brand])).rows).toEqual([{ toFlavor: 'black' }]);
  const listed = await checks.listCatalogCards(brand, 1, 10);
  expect(listed.items.find(item => item.flavor === 'Тропик')).toMatchObject({ mergedInto: { brand, flavor: 'black' } });
});

it('hides a card, names it and gives it our own cover', async () => {
  const juice = { brand, flavor: 'juice' }, black = { brand, flavor: 'black' };
  await edits.setCardHidden(staff, staffEmail, juice, true);
  await edits.setCardFullName(staff, staffEmail, black, 'Карточка Max Black');
  await edits.setCardPhoto(staff, staffEmail, black, { data: Buffer.from('cover'), thumbnail: Buffer.from('thumb') });
  const shown = (await edits.withCardEdits(await files.readAllCatalogGroups())).filter(group => group.brand === brand);
  expect(shown).toHaveLength(1);
  expect(shown[0]).toMatchObject({ flavor: 'black', fullName: 'Карточка Max Black', coverImageUrl: expect.stringMatching(/^\/api\/catalog-card-photos\/[0-9a-f-]{36}\/\d+$/u) });
  const id = shown[0]!.coverImageUrl!.split('/')[3]!;
  expect((await edits.getCardPhoto(id, 'full'))!.toString()).toBe('cover');
  expect((await edits.getCardPhoto(id, 'thumbnail'))!.toString()).toBe('thumb');
  // Back: the parser's cover and the hidden card return; every change is in the journal.
  await edits.setCardPhoto(staff, staffEmail, black, null);
  await edits.setCardHidden(staff, staffEmail, juice, false);
  const back = (await edits.withCardEdits(await files.readAllCatalogGroups())).filter(group => group.brand === brand);
  expect(back.map(group => [group.flavor, group.coverImageUrl ?? null])).toEqual([['black', '/black.jpg'], ['juice', null]]);
  expect((await pool.query(`select action from "adminAuditLog" where "adminEmail" = $1 order by id`, [staffEmail])).rows.map(row => row.action))
    .toEqual(['catalog-card-merge', 'catalog-card-hide', 'catalog-card-name', 'catalog-card-photo', 'catalog-card-photo-reset', 'catalog-card-show']);
});
