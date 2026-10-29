import { randomUUID } from 'node:crypto';
import { afterAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Test DB only');
const pool = new Pool({ connectionString: url, max: 3, allowExitOnIdle: true });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
vi.mock('react', async original => ({ ...await original<typeof import('react')>(), cache: <T,>(fn: T) => fn }));
const brand = `Перепроверка ${randomUUID().slice(0, 6)}`;
const offer = (url: string) => ({ source: 'edadeal', price: 90, url });
// Files the test can change between passes: the second pass brings a new card whose flavour is in an old card's mix.
const files = { groups: [
  { brand, flavor: 'blend:melon+watermelon', variants: [offer('https://edadeal.ru/moskva/search?text=Watermelon+Melon')], minPrice: 90 },
  { brand, flavor: 'mango', variants: [offer('https://edadeal.ru/moskva/search?text=Mango')], minPrice: 90 },
] as { brand: string; flavor: string; variants: { source: string; price: number; url: string }[]; minPrice: number }[] };
vi.mock('../src/lib/catalog-files', () => ({ readAllCatalogGroups: async () => files.groups }));
const check = await import('../src/lib/catalog-card-check');
const { DUPLICATE_CHECK_VERSION, DUPLICATE_HINTS } = await import('../src/lib/drink-duplicate-fields');

afterAll(async () => {
  await pool.query('delete from "catalogCardCheck" where brand = $1', [brand]);
  await pool.end();
});

it('checks again what an older algorithm or older data judged, and the old card a new twin points at — once', async () => {
  const asked: string[] = [];
  const client = { chat: async (messages: { content: string }[]) => { asked.push(messages[1]!.content.split('\n')[0]!); return '{"verdict":"new","match":null}'; } };
  const row = async (flavor: string) => (await pool.query('select verdict, version from "catalogCardCheck" where brand = $1 and flavor = $2', [brand, flavor])).rows[0];
  expect(await check.runCardChecks(client, 20, 0)).toMatchObject({ checked: 2 });
  expect(await row('mango')).toEqual({ verdict: 'new', version: DUPLICATE_CHECK_VERSION });
  expect(await check.runCardChecks(client, 20, 0)).toMatchObject({ checked: 0 });

  // A row from the older algorithm is asked again; so is a card whose shop names changed — while the hints are on.
  await pool.query('update "catalogCardCheck" set version = 1 where brand = $1 and flavor = $2', [brand, 'mango']);
  expect(await check.runCardChecks(client, 20, 0)).toMatchObject({ checked: 1 });
  files.groups[1]!.variants = [offer('https://edadeal.ru/moskva/search?text=Mango+Loco')];
  expect(await check.runCardChecks(client, 20, 0)).toMatchObject({ checked: DUPLICATE_HINTS ? 1 : 0 });

  // A new card, «Арбуз», is in the mix of the old «Дыня + Арбуз»: its first check sends the old card back for another
  // look; that second look is not a first check, so nothing bounces back and the third pass asks nothing.
  files.groups.push({ brand, flavor: 'watermelon', variants: [offer('https://edadeal.ru/moskva/search?text=Watermelon')], minPrice: 90 });
  asked.length = 0;
  expect(await check.runCardChecks(client, 20, 0)).toMatchObject({ checked: 1 });
  expect(asked[0]).toContain('Новый напиток');
  if (!DUPLICATE_HINTS) {
    // Without the hints the model's «new» stands and nothing is sent back.
    expect(await row('watermelon')).toMatchObject({ verdict: 'new' });
    expect(await row('blend:melon+watermelon')).toEqual({ verdict: 'new', version: DUPLICATE_CHECK_VERSION });
    expect(await check.runCardChecks(client, 20, 0)).toMatchObject({ checked: 0 });
    return;
  }
  expect(await row('watermelon')).toMatchObject({ verdict: 'unsure' });
  expect(await row('blend:melon+watermelon')).toEqual({ verdict: 'new', version: 0 });
  expect(await check.runCardChecks(client, 20, 0)).toMatchObject({ checked: 1 });
  expect(await row('blend:melon+watermelon')).toMatchObject({ version: DUPLICATE_CHECK_VERSION });
  expect(await check.runCardChecks(client, 20, 0)).toMatchObject({ checked: 0 });
});
