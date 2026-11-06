import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Test DB only');
const pool = new Pool({ connectionString: url, max: 3, allowExitOnIdle: true });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
// React's request cache would keep the first list of edits for the whole file.
vi.mock('react', async original => ({ ...await original<typeof import('react')>(), cache: <T,>(fn: T) => fn }));
// The parser's files: «Тропик» (to be renamed after a redesign), «Манго» and «Лайм», which later shows up under the new name.
const fixture = vi.hoisted(() => ({ brand: `Редизайн ${Math.random().toString(16).slice(2, 8)}`, newName: false }));
vi.mock('../src/lib/catalog-files', () => ({ readAllCatalogGroups: async () => [
  { brand: fixture.brand, flavor: 'Тропик', variants: [{ source: 'edadeal', price: 89, url: 'old' }], minPrice: 89, coverImageUrl: '/old.jpg' },
  { brand: fixture.brand, flavor: 'mango', variants: [{ source: 'edadeal', price: 99, url: 'mango' }], minPrice: 99 },
  ...(fixture.newName ? [{ brand: fixture.brand, flavor: 'Тропик Микс', variants: [{ source: 'lavka', price: 95, url: 'new' }], minPrice: 95, coverImageUrl: '/new.jpg' }] : []),
] }));
const edits = await import('../src/lib/catalog-card-edits');
const files = await import('../src/lib/catalog-files');
const checks = await import('../src/lib/catalog-card-check');

const { brand } = fixture;
const [member, staff, owner] = [randomUUID(), randomUUID(), randomUUID()];
const staffEmail = `${staff}@example.com`;
let companyId = '';
const old = { brand, flavor: 'Тропик' }, renamed = { brand, flavor: 'Тропик Микс' };
const shownNow = async () => (await edits.withCardEdits(await files.readAllCatalogGroups())).filter(group => group.brand === brand);
const rename = async (card: { brand: string; flavor: string }, next: { brand: string; flavor: string }) =>
  edits.renameCatalogCard(staff, staffEmail, card, next, await files.readAllCatalogGroups(), await shownNow());

beforeAll(async () => {
  for (const id of [member, staff, owner]) await pool.query(`insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt",username) values($1,'Rename test',$2,true,now(),now(),$3)`, [id, `${id}@example.com`, `rn_${id.slice(0, 12)}`]);
  await pool.query(`insert into "siteAdmin"(email, role) values ($1, 'moderator')`, [staffEmail]);
  companyId = (await pool.query<{ id: string }>(`insert into business ("ownerId", name, kind, status) values ($1, 'Редизайн Лаб', 'brand', 'approved') returning id`, [owner])).rows[0]!.id;
  await pool.query(`insert into "businessDrink"("businessId", brand, flavor, status) values ($1, $2, 'Тропик', 'approved')`, [companyId, brand]);
  await pool.query(`insert into "brandDrinkPrice"("businessId", "userId", brand, flavor, "volumeMl", "maxPrice") values ($1, $2, $3, 'Тропик', 450, 119)`, [companyId, owner, brand]);
  await pool.query(`insert into review(id, "userId", brand, flavor, design, taste, text, "createdAt", "updatedAt") values (gen_random_uuid(), $1, $2, 'Тропик', 8, 9, 'Отзыв', now(), now())`, [member, brand]);
});
afterAll(async () => {
  await pool.query('delete from business where id = $1', [companyId]);
  await pool.query('delete from "catalogCardEdit" where brand = $1', [brand]);
  await pool.query('delete from "catalogDrinkRename" where "fromBrand" = $1', [brand]);
  await pool.query('delete from "adminAuditLog" where "adminEmail" = $1', [staffEmail]);
  await pool.query('delete from "siteAdmin" where email = $1', [staffEmail]);
  await pool.query('delete from "user" where id = any($1::text[])', [[member, staff, owner]]);
  await pool.end();
});

it('renames a card: it shows under the new name with its offers, everything on it moves, the old address redirects', async () => {
  await edits.setCardFullName(staff, staffEmail, old, 'Редизайн Тропик Классик');
  await expect(edits.renameCatalogCard(member, `${member}@example.com`, old, renamed, await files.readAllCatalogGroups(), await shownNow())).rejects.toThrow('Нет доступа');
  await rename(old, renamed);
  expect((await shownNow()).map(group => [group.flavor, group.minPrice, group.fullName ?? null])).toEqual([['Тропик Микс', 89, 'Редизайн Тропик Классик'], ['mango', 99, null]]);
  expect((await pool.query('select flavor from review where "userId" = $1', [member])).rows).toEqual([{ flavor: 'Тропик Микс' }]);
  // The company keeps its confirmed drink and its price ceiling.
  expect((await pool.query('select flavor, status from "businessDrink" where "businessId" = $1', [companyId])).rows).toEqual([{ flavor: 'Тропик Микс', status: 'approved' }]);
  expect((await pool.query('select flavor from "brandDrinkPrice" where "businessId" = $1', [companyId])).rows).toEqual([{ flavor: 'Тропик Микс' }]);
  expect((await pool.query('select "fromFlavor", "toFlavor" from "catalogDrinkRename" where "fromBrand" = $1', [brand])).rows).toEqual([{ fromFlavor: 'Тропик', toFlavor: 'Тропик Микс' }]);
  // The admin lists it once, under the new name, with the old one.
  const { items } = await checks.listCatalogCards(brand, 1, 50);
  expect(items.map(card => [card.flavor, card.renamedFrom, card.mergedInto, card.fullName])).toEqual([['mango', [], null, null], ['Тропик Микс', [`${brand} · Тропик`], null, 'Редизайн Тропик Классик']]);
});

it('treats a name the catalog has, or another card’s old name, as a duplicate to merge', async () => {
  await expect(rename(renamed, { brand, flavor: 'mango' })).rejects.toBeInstanceOf(edits.CatalogCardDuplicate);
  await expect(rename(renamed, { brand: brand.toUpperCase(), flavor: 'MANGO' })).rejects.toThrow('уже есть в каталоге');
  // «Тропик» leads to this very card: going back is a rename, not a clash. But for «Манго» it is another card's old name.
  await expect(rename({ brand, flavor: 'mango' }, old)).rejects.toMatchObject({ target: { brand, flavor: 'Тропик Микс' } });
});

it('joins the parser’s card under the new name into the renamed one, so no second card appears', async () => {
  fixture.newName = true;
  const shown = await shownNow();
  expect(shown.map(group => [group.flavor, group.variants.length, group.coverImageUrl ?? null])).toEqual([['Тропик Микс', 2, '/new.jpg'], ['mango', 1, null]]);
  const { items } = await checks.listCatalogCards(brand, 1, 50);
  expect(items.find(card => card.flavor === 'Тропик Микс')).toMatchObject({ offers: 2, renamedFrom: [`${brand} · Тропик`] });
  fixture.newName = false;
});

it('renames back to the old name, and chains renames without loops', async () => {
  await rename(renamed, { brand, flavor: 'Тропик Классик' });
  expect((await shownNow()).map(group => group.flavor)).toEqual(['Тропик Классик', 'mango']);
  expect((await pool.query('select "fromFlavor", "toFlavor" from "catalogDrinkRename" where "fromBrand" = $1 order by "fromFlavor"', [brand])).rows)
    .toEqual([{ fromFlavor: 'Тропик', toFlavor: 'Тропик Классик' }, { fromFlavor: 'Тропик Микс', toFlavor: 'Тропик Классик' }]);
  await rename({ brand, flavor: 'Тропик Классик' }, old);
  expect((await shownNow()).map(group => [group.flavor, group.fullName ?? null])).toEqual([['Тропик', 'Редизайн Тропик Классик'], ['mango', null]]);
  expect((await pool.query('select flavor from review where "userId" = $1', [member])).rows).toEqual([{ flavor: 'Тропик' }]);
  expect((await pool.query('select "mergedIntoFlavor" from "catalogCardEdit" where brand = $1 and flavor = $2', [brand, 'Тропик'])).rows).toEqual([{ mergedIntoFlavor: null }]);
  // The old name is a live card again: its address no longer redirects, the others lead to it.
  expect((await pool.query('select "fromFlavor", "toFlavor" from "catalogDrinkRename" where "fromBrand" = $1 order by "fromFlavor"', [brand])).rows)
    .toEqual([{ fromFlavor: 'Тропик Классик', toFlavor: 'Тропик' }, { fromFlavor: 'Тропик Микс', toFlavor: 'Тропик' }]);
  const { items } = await checks.listCatalogCards(brand, 1, 50);
  expect(items.map(card => [card.flavor, card.renamedFrom])).toEqual([['mango', []], ['Тропик', []]]);
  await expect(rename(old, old)).rejects.toThrow('Название не изменилось.');
});

it('moves the company data on a plain merge too', async () => {
  await edits.mergeCatalogCard(staff, staffEmail, old, { brand, flavor: 'mango' });
  expect((await pool.query('select flavor, status from "businessDrink" where "businessId" = $1', [companyId])).rows).toEqual([{ flavor: 'mango', status: 'approved' }]);
});
