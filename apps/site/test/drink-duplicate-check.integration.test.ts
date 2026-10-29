import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Test DB only');
const pool = new Pool({ connectionString: url, max: 3, allowExitOnIdle: true });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
const brand = `Дубль ${randomUUID().slice(0, 6)}`;
// The parser's files: one card of the test brand to be repeated.
vi.mock('../src/lib/catalog-files', () => ({ readAllCatalogGroups: async () => [{ brand, flavor: 'tornado_lemoncake', variants: [{}], minPrice: 1 }] }));
const check = await import('../src/lib/drink-duplicate-check');
const drinks = await import('../src/lib/catalog-drinks');

const [author, staff] = [randomUUID(), randomUUID()];
const staffEmail = `${staff}@example.com`;
const ids: string[] = [];
const insert = async (flavor: string, status: string, fullName = '') => {
  const id = (await pool.query<{ id: string }>(`insert into "catalogDrink"("ownerId", brand, flavor, "fullName", volumes, ingredients, photo, thumbnail, status)
    values ($1, $2, $3, $4, '{450}', '', '\\x00', '\\x00', $5) returning id`, [author, brand, flavor, fullName, status])).rows[0]!.id;
  ids.push(id); return id;
};

beforeAll(async () => {
  for (const id of [author, staff]) await pool.query(`insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt",username) values($1,'Dup test',$2,true,now(),now(),$3)`, [id, `${id}@example.com`, `dp_${id.slice(0, 12)}`]);
  await pool.query(`insert into "siteAdmin"(email, role) values ($1, 'moderator')`, [staffEmail]);
});
afterAll(async () => {
  await pool.query('delete from "adminAuditLog" where "adminEmail" = $1', [staffEmail]);
  await pool.query('delete from "siteAdmin" where email = $1', [staffEmail]);
  await pool.query('delete from "user" where id = any($1::text[])', [[author, staff]]);
  await pool.end();
});

it('marks a request that repeats a catalog card, puts it first and lets the team clear a published one', async () => {
  const plain = await insert('apple', 'pending');
  const twin = await insert('Лимонный пирог', 'pending', 'energy lemoncake');
  const published = await insert('mango', 'published');
  const asked: string[] = [];
  // The fake model: the content filter refuses any list with «Mango», «lemoncake» is the parser card's twin.
  const client = { chat: async (messages: { content: string }[]) => {
    const user = messages[1]!.content; asked.push(user);
    if (/Новый напиток: .*Манго/u.test(user) && /Манго/u.test(user.split('Карточки')[1] ?? '')) return 'Генеративные языковые модели не обладают собственным мнением';
    if (user.includes('Лимонный пирог')) return '{"verdict":"duplicate","match":1,"reason":"тот же лимонный пирог"}';
    return '{"verdict":"new","match":null,"reason":"другой вкус"}';
  } };
  expect(await check.runDrinkChecks(client, 20, 0)).toEqual({ checked: 3, failed: 0 });
  const verdicts = await check.getDrinkChecks([plain, twin, published]);
  expect(verdicts.get(twin)).toMatchObject({ verdict: 'duplicate', matchLabel: expect.stringContaining(brand), matchHref: expect.stringMatching(/^\/catalog\//u), reason: 'тот же лимонный пирог' });
  expect(verdicts.get(plain)).toMatchObject({ verdict: 'new' });
  // Nothing to re-check until a drink changes.
  expect(await check.runDrinkChecks(client, 20, 0)).toEqual({ checked: 0, failed: 0 });

  // The flagged request comes first in the queue.
  const queue = (await drinks.listCatalogDrinks('pending', 1, 50, brand)).items.map(item => item.id);
  expect(queue.indexOf(twin)).toBeLessThan(queue.indexOf(plain));

  // A published drink the network suspects goes to «Возможные дубли» until the team clears it.
  await pool.query(`update "catalogDrinkCheck" set verdict = 'unsure', "matchBrand" = $2, "matchFlavor" = 'apple' where "drinkId" = $1`, [published, brand]);
  expect((await drinks.listCatalogDrinks('published', 1, 50, brand, { suspects: true })).items.map(item => item.id)).toEqual([published]);
  await check.dismissDrinkCheck(author, `${author}@example.com`, published);
  expect((await drinks.listCatalogDrinks('published', 1, 50, brand, { suspects: true })).items).toHaveLength(1);
  await check.dismissDrinkCheck(staff, staffEmail, published);
  expect((await drinks.listCatalogDrinks('published', 1, 50, brand, { suspects: true })).items).toHaveLength(0);
  expect((await check.getDrinkChecks([published])).get(published)).toMatchObject({ dismissed: true });

  // An edit makes the drink due again; the same match keeps «не дубль», a new one clears it.
  await pool.query(`update "catalogDrink" set "updatedAt" = clock_timestamp() where id = $1`, [published]);
  await check.checkDrinkDuplicates({ chat: async () => '{"verdict":"new","match":null,"reason":""}' }, published);
  expect((await check.getDrinkChecks([published])).get(published)).toMatchObject({ verdict: 'new', dismissed: false });
});

it('asks the halves when the filter refuses the whole list and does not trust a half-answered «new»', async () => {
  const candidates = Array.from({ length: 4 }, (_, index) => ({ brand, flavor: `f${index}`, kind: 'shop' as const }));
  let calls = 0;
  const refusing = { chat: async (messages: { content: string }[]) => { calls++; return messages[1]!.content.includes('f0') ? 'Как и любая языковая модель…' : '{"verdict":"new","match":null}'; } };
  expect(await check.judgeDrink(refusing, { brand, flavor: 'x' }, candidates)).toMatchObject({ verdict: 'failed' });
  expect(calls).toBe(4); // two votes on the whole list, then one per half
  const finding = { chat: async (messages: { content: string }[]) => messages[1]!.content.includes('f0') ? '…мнением' : messages[1]!.content.includes('f2') ? '{"verdict":"duplicate","match":1,"reason":"да"}' : '{"verdict":"new"}' };
  expect(await check.judgeDrink(finding, { brand, flavor: 'x' }, candidates)).toMatchObject({ verdict: 'duplicate', match: { flavor: 'f2' } });
  expect(await check.judgeDrink(finding, { brand: 'Другой', flavor: 'x' }, candidates)).toMatchObject({ verdict: 'new' });
  // A flavour that is part of a barely-sold card's mix goes to the moderator even when the model says «new».
  const fresh = { chat: async () => '{"verdict":"new","match":null}' };
  const mixCard = { brand, flavor: 'blend:melon+watermelon', kind: 'archive' as const };
  expect(await check.judgeDrink(fresh, { brand, flavor: 'watermelon', offers: 1 }, [mixCard, { brand, flavor: 'mango', kind: 'shop' as const, offers: 9 }]))
    .toMatchObject({ verdict: 'unsure', match: { flavor: 'blend:melon+watermelon' }, confident: false });
  expect(await check.judgeDrink(fresh, { brand, flavor: 'watermelon', offers: 9 }, [{ ...mixCard, kind: 'shop' as const, offers: 9 }])).toMatchObject({ verdict: 'new' });
});
