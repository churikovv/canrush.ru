import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Test DB only');
const pool = new Pool({ connectionString: url, max: 3, allowExitOnIdle: true });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
vi.mock('react', async original => ({ ...await original<typeof import('react')>(), cache: <T,>(fn: T) => fn }));
const brand = `Проверка ${randomUUID().slice(0, 6)}`;
const offer = (url: string) => ({ source: 'edadeal', price: 90, url });
// Parser cards: a shop card with an archived twin, a card the model doubts, a plain one and one with an unread flavour.
vi.mock('../src/lib/catalog-files', () => ({ readAllCatalogGroups: async () => [
  { brand, flavor: 'black', variants: [offer('a')], minPrice: 90 },
  { brand, flavor: 'Тропик', variants: [], minPrice: 0 },
  { brand, flavor: 'storm', variants: [offer('b')], minPrice: 90 },
  { brand, flavor: 'barberry', variants: [offer('c')], minPrice: 90 },
  { brand, flavor: 'unresolved:abc', variants: [offer('https://edadeal.ru/moskva/search?text=Энергетик+Странный+0.45')], minPrice: 90 },
] }));
const check = await import('../src/lib/catalog-card-check');
const files = await import('../src/lib/catalog-files');
const edits = await import('../src/lib/catalog-card-edits');
const { flavorName } = await import('../src/lib/catalog-query');

const staff = randomUUID();
const staffEmail = `${staff}@example.com`;
beforeAll(async () => {
  await pool.query(`insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt",username) values($1,'Check test',$2,true,now(),now(),$3)`, [staff, staffEmail, `ck_${staff.slice(0, 12)}`]);
  await pool.query(`insert into "siteAdmin"(email, role) values ($1, 'moderator')`, [staffEmail]);
});
afterAll(async () => {
  for (const table of ['catalogCardCheck', 'catalogCardEdit']) await pool.query(`delete from "${table}" where brand = $1`, [brand]);
  await pool.query('delete from "catalogDrinkRename" where "fromBrand" = $1', [brand]);
  await pool.query(`delete from "adminAuditLog" where "targetId" like $1`, [`${brand}%`]);
  await pool.query('delete from "siteAdmin" where email = $1', [staffEmail]);
  await pool.query('delete from "user" where id = $1', [staff]);
  await pool.end();
});

it('merges a sure duplicate on its own, keeps the card in shops and sends doubts and unread flavours to the team', async () => {
  // The fake model: «Тропик» is surely Black (the archived card names the shop card), «Storm» is a split vote on
  // Barberry, the rest are new. The shortlist is the card's brand, numbered in the order of the files.
  let stormAnswers = 0;
  const client = { chat: async (messages: { content: string }[]) => {
    const user = messages[1]!.content;
    const list = user.split('Карточки бренда в каталоге:\n')[1]!.split('\n');
    const at = (flavor: string) => list.findIndex(line => line.includes(`· ${flavorName(flavor)} —`)) + 1;
    const asked = (flavor: string) => user.startsWith(`Новый напиток: ${brand} · ${flavorName(flavor)}`);
    if (asked('Тропик')) return `{"verdict":"duplicate","match":${at('black')},"reason":"та же банка"}`;
    if (asked('storm')) return stormAnswers++ % 2 ? '{"verdict":"new","match":null}' : `{"verdict":"duplicate","match":${at('barberry')},"reason":"похоже"}`;
    return '{"verdict":"new","match":null,"reason":"другой вкус"}';
  } };
  const result = await check.runCardChecks(client, 20, 0);
  expect(result.merged).toBe(1);
  const shown = (await edits.withCardEdits(await files.readAllCatalogGroups())).filter(group => group.brand === brand).map(group => group.flavor);
  expect(shown).not.toContain('Тропик');
  expect(shown).toContain('black');
  expect((await pool.query(`select action, "adminEmail" from "adminAuditLog" where "targetId" = $1`, [`${brand} · Тропик`])).rows).toEqual([{ action: 'catalog-card-auto-merge', adminEmail: 'нейросеть' }]);

  const queue = await check.listCatalogCards(brand, 1, 20, 'queue');
  expect(queue.items.map(item => [item.flavor, item.check?.verdict]).sort()).toEqual([['storm', 'unsure'], ['unresolved:abc', 'unknown']]);
  expect(queue.items.find(item => item.flavor === 'unresolved:abc')!.check!.title).toBe('Энергетик Странный 0.45');
  expect(await check.countCardQueue()).toBeGreaterThanOrEqual(2);
  expect((await check.listCatalogCards(brand, 1, 20, 'auto')).items.map(item => item.flavor)).toEqual(['Тропик']);

  // Checked once: a second pass asks nothing.
  expect(await check.runCardChecks({ chat: async () => { throw new Error('asked again'); } }, 20, 0)).toEqual({ checked: 0, merged: 0, failed: 0 });

  // The team clears a doubt; only staff may.
  await check.dismissCardCheck(randomUUID(), 'x@example.com', { brand, flavor: 'storm' });
  expect((await check.listCatalogCards(brand, 1, 20, 'queue')).items).toHaveLength(2);
  await check.dismissCardCheck(staff, staffEmail, { brand, flavor: 'storm' });
  expect((await check.listCatalogCards(brand, 1, 20, 'queue')).items.map(item => item.flavor)).toEqual(['unresolved:abc']);
});
