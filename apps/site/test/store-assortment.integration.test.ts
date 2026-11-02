import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Test DB only');
const pool = new Pool({ connectionString: url, max: 3 });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
const { deleteStorePreset, listPublicStorePresets, listStorePresets, saveStorePreset, searchStoresToCopy, storeAssortment } = await import('../src/lib/store-assortment');
const { MAX_STORE_PRESETS, MIN_PUBLIC_PRESET_DRINKS } = await import('../src/lib/store-preset-fields');
const { createContentReport } = await import('../src/lib/profile-reports');
const { staffDeleteContent } = await import('../src/lib/staff-moderation');

const [me, other, banned] = [randomUUID(), randomUUID(), randomUUID()] as [string, string, string];
const everyone = [me, other, banned];
const mark = `Сеть ${randomUUID()}`;
const items = [{ name: 'Свой напиток', price: 9900, availability: 'unknown' }];

async function store(owner: string, name: string, status: string, catalog: object[] = items, city = 'moscow') {
  return (await pool.query<{ id: string }>(`insert into "marketStore" ("ownerId", name, city, address, status, catalog) values ($1, $2, $3, $4, $5, $6) returning id`, [owner, name, city, `${mark} ${randomUUID()}`, status, JSON.stringify(catalog)])).rows[0]!.id;
}

beforeAll(async () => {
  for (const id of everyone) await pool.query(`insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt") values($1,'Копия',$2,true,now(),now())`, [id, `${id}@example.com`]);
  await pool.query('insert into "userBlock" ("userId") values ($1)', [banned]);
});

afterAll(async () => {
  await pool.query('delete from "marketStore" where "ownerId" = any($1)', [everyone]);
  await pool.query('delete from "user" where id = any($1::text[])', [everyone]);
  await pool.end();
});

it('finds own stores first, then the city, and only what can be copied', async () => {
  const mine = await store(me, 'Мой черновик', 'draft');
  const near = await store(other, 'Рядом', 'published');
  const far = await store(other, 'Далеко', 'published', items, 'spb');
  await store(me, 'Мой отказ', 'rejected');
  await store(other, 'Чужой на проверке', 'pending');
  await store(banned, 'Заблокированный', 'published');
  await store(other, 'Пустой', 'published', []);
  const found = await searchStoresToCopy(me, mark, 'moscow', null);
  expect(found.map(row => row.id)).toEqual([mine, near, far]);
  expect(found[0]).toMatchObject({ own: true, drinks: 1 });
  expect((await searchStoresToCopy(me, mark, 'moscow', mine)).map(row => row.id)).toEqual([near, far]);
  expect((await searchStoresToCopy(me, 'МОЙ ЧЕРНОВИК', 'moscow', null)).map(row => row.id)).toContain(mine);
});

it('gives prices of own stores only, whatever the browser asks for', async () => {
  const mine = await store(me, 'Мой', 'published');
  const theirs = await store(other, 'Чужой', 'published');
  expect(await storeAssortment(me, mine)).toMatchObject({ store: 'Мой', withPrices: true, items });
  expect(await storeAssortment(me, theirs)).toMatchObject({ store: 'Чужой', withPrices: false, items: [{ name: 'Свой напиток', price: null, availability: 'available' }] });
});

it('refuses stores that are not open to the member', async () => {
  expect(await storeAssortment(me, await store(other, 'На проверке', 'pending'))).toBeNull();
  expect(await storeAssortment(me, await store(banned, 'Заблокированный', 'published'))).toBeNull();
  expect(await storeAssortment(me, await store(other, 'Пустой', 'published', []))).toBeNull();
  expect(await storeAssortment(me, 'not-an-id')).toBeNull();
});

it('keeps a member’s presets to themselves, without prices, edits by id and refuses a repeated name', async () => {
  await saveStorePreset(me, 'Сеть', [{ name: 'Свой напиток', price: 9900 }]);
  await expect(saveStorePreset(me, 'сеть', [{ name: 'Другой' }])).rejects.toThrow('уже есть');
  const id = (await listStorePresets(me))[0]!.id;
  await saveStorePreset(me, 'сеть', [{ name: 'Другой' }, { name: 'Третий' }], false, id);
  const presets = await listStorePresets(me);
  expect(presets).toHaveLength(1);
  expect(presets[0]).toMatchObject({ id, name: 'сеть', drinks: [{ name: 'Другой' }, { name: 'Третий' }] });
  expect(JSON.stringify(presets)).not.toContain('price');
  await expect(saveStorePreset(other, 'Чужой', [{ name: 'Свой' }], false, id)).rejects.toThrow('не найден');
  expect(await listStorePresets(other)).toEqual([]);
  await deleteStorePreset(other, presets[0]!.id);
  expect(await listStorePresets(me)).toHaveLength(1);
  await deleteStorePreset(me, presets[0]!.id);
  expect(await listStorePresets(me)).toEqual([]);
});

it('turns an unknown catalog link into a typed drink', async () => {
  await saveStorePreset(me, 'Ссылка', [{ name: 'Выдуманный', brand: 'Нет такого', flavor: 'бренда' }]);
  expect((await listStorePresets(me))[0]?.drinks).toEqual([{ name: 'Выдуманный' }]);
  await pool.query('delete from "storePreset" where "userId" = $1', [me]);
});

it('limits presets and refuses blocked members', async () => {
  for (let index = 0; index < MAX_STORE_PRESETS; index += 1) await saveStorePreset(other, `Шаблон ${index}`, [{ name: 'Свой' }]);
  await expect(saveStorePreset(other, 'Лишний', [{ name: 'Свой' }])).rejects.toThrow('Удалите');
  await saveStorePreset(other, 'Шаблон 0', [{ name: 'Другой' }], false, (await listStorePresets(other)).find(preset => preset.name === 'Шаблон 0')!.id);
  await expect(saveStorePreset(banned, 'Шаблон', [{ name: 'Свой' }])).rejects.toThrow('ограничены');
});

describe('published presets', () => {
  const three = [{ name: 'Первый' }, { name: 'Второй' }, { name: 'Третий' }];
  const [author, viewer] = [randomUUID(), randomUUID()] as [string, string];
  const nick = (id: string) => `p${id.replaceAll('-', '').slice(0, 20)}`;
  const shared = async (user: string) => (await listPublicStorePresets(user)).filter(preset => preset.author === nick(author));

  beforeAll(async () => {
    for (const id of [author, viewer]) await pool.query(`insert into "user"(id,name,email,"emailVerified",username,"createdAt","updatedAt") values($1,'Автор',$2,true,$3,now(),now())`, [id, `${id}@example.com`, nick(id)]);
  });
  afterEach(async () => {
    await pool.query('delete from "memberBlock" where "blockerId" = any($1)', [[author, viewer]]);
    await pool.query('delete from "userFreeze" where "userId" = any($1)', [[author, viewer]]);
    await pool.query('delete from "userBlock" where "userId" = any($1)', [[author, viewer]]);
    await pool.query('delete from "storePreset" where "userId" = any($1)', [[author, viewer]]);
  });
  afterAll(async () => {
    await pool.query('delete from "profileReport" where "userId" = any($1) or "targetId" = any($1)', [[author, viewer]]);
    await pool.query('delete from "user" where id = any($1::text[])', [[author, viewer]]);
  });

  it('shows a published preset to others with its author, and only then', async () => {
    await saveStorePreset(author, 'Для себя', three);
    expect(await shared(viewer)).toEqual([]);
    await saveStorePreset(author, 'Для всех', three, true);
    expect(await shared(viewer)).toMatchObject([{ name: 'Для всех', author: nick(author), drinks: three }]);
    expect(await shared(author)).toEqual([]);
    expect((await listStorePresets(author)).map(preset => [preset.name, preset.published])).toEqual(expect.arrayContaining([['Для всех', true], ['Для себя', false]]));
  });

  it('publishes and hides an existing preset, only its own author can', async () => {
    await saveStorePreset(author, 'Шаблон', three);
    const id = (await listStorePresets(author))[0]!.id;
    await expect(saveStorePreset(viewer, 'Шаблон', three, true, id)).rejects.toThrow('не найден');
    expect(await shared(viewer)).toEqual([]);
    await saveStorePreset(author, 'Шаблон', three, true, id);
    expect(await shared(viewer)).toHaveLength(1);
    await saveStorePreset(author, 'Шаблон', three, false, id);
    expect(await shared(viewer)).toEqual([]);
  });

  it('keeps its place in the list when a published preset is edited', async () => {
    await saveStorePreset(author, 'Шаблон', three, true);
    const id = (await listStorePresets(author))[0]!.id;
    const when = (await pool.query<{ at: Date }>('select "publishedAt" as at from "storePreset" where id = $1', [id])).rows[0]!.at;
    await saveStorePreset(author, 'Новое имя', [...three, { name: 'Четвёртый' }], true, id);
    expect(await shared(viewer)).toMatchObject([{ name: 'Новое имя' }]);
    expect((await shared(viewer))[0]?.drinks).toHaveLength(4);
    expect((await pool.query<{ at: Date }>('select "publishedAt" as at from "storePreset" where id = $1', [id])).rows[0]!.at).toEqual(when);
  });

  it('wants a few drinks and a nick', async () => {
    await expect(saveStorePreset(author, 'Мало', three.slice(0, MIN_PUBLIC_PRESET_DRINKS - 1), true)).rejects.toThrow('Показать всем');
    await pool.query('update "user" set username = null where id = $1', [author]);
    await expect(saveStorePreset(author, 'Без ника', three, true)).rejects.toThrow('ник');
    await pool.query('update "user" set username = $2 where id = $1', [author, nick(author)]);
  });

  it('hides authors blocked by the team or by the viewer', async () => {
    await saveStorePreset(author, 'Шаблон', three, true);
    await pool.query('insert into "memberBlock" ("blockerId", "blockedId") values ($1, $2)', [viewer, author]);
    expect(await shared(viewer)).toEqual([]);
    await pool.query('delete from "memberBlock" where "blockerId" = $1', [viewer]);
    await pool.query('insert into "userBlock" ("userId") values ($1)', [author]);
    expect(await shared(viewer)).toEqual([]);
  });

  it('stops a frozen member from publishing, not from keeping a private preset or hiding one', async () => {
    await saveStorePreset(author, 'Шаблон', three, true);
    const id = (await listStorePresets(author))[0]!.id;
    await pool.query(`insert into "userFreeze" ("userId", until) values ($1, now() + interval '1 day')`, [author]);
    await expect(saveStorePreset(author, 'Новый', three, true)).rejects.toMatchObject({ code: 'CR002' });
    await saveStorePreset(author, 'Для себя', three);
    await saveStorePreset(author, 'Шаблон', three, false, id);
    await expect(saveStorePreset(author, 'Шаблон', three, true, id)).rejects.toMatchObject({ code: 'CR002' });
  });

  it('can be reported once published, with its drinks in the excerpt, and deleted by staff', async () => {
    await saveStorePreset(author, 'Шаблон', three);
    const id = (await listStorePresets(author))[0]!.id;
    expect(await createContentReport(viewer, 'store-preset', id, 'spam', '', '/market/stores/new')).toBe('invalid');
    await saveStorePreset(author, 'Шаблон', three, true, id);
    expect(await createContentReport(viewer, 'store-preset', id, 'spam', '', '/market/stores/new')).toBe('sent');
    expect((await pool.query<{ excerpt: string }>('select excerpt from "profileReport" where "contentId" = $1', [id])).rows[0]?.excerpt).toContain('Первый');
    const email = `${viewer}@example.com`;
    await pool.query(`insert into "siteAdmin" (email, role) values ($1, 'moderator')`, [email]);
    expect(await staffDeleteContent(viewer, 'store-preset', id)).toBe(true);
    await pool.query('delete from "siteAdmin" where email = $1', [email]);
    await pool.query(`delete from "adminAuditLog" where "targetId" = $1`, [id]);
    expect(await shared(viewer)).toEqual([]);
  });
});
