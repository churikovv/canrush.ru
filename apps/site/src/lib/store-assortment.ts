import { CITIES } from '@canrush/shared';
import type { PoolClient } from 'pg';
import { getPool } from '@/db/pool';
import { withCardEdits } from '@/lib/catalog-card-edits';
import { activeOffers, readCityCatalog } from '@/lib/catalog-files';
import { notBlockedBy } from '@/lib/member-blocks';
import { linkStoreCatalog, storeDrinkOptions } from '@/lib/store-catalog';
import { copyStoreItems, type StoreClipboard } from '@/lib/store-clipboard';
import { StoreError, type StoreItem } from '@/lib/store-fields';
import { MAX_STORE_PRESETS, MIN_PUBLIC_PRESET_DRINKS, PUBLIC_PRESETS_SHOWN, massMarketPresets, parsePresetDrinks, parsePresetName, presetItems, type CopyStoreOption, type PresetDrink, type ReadyPreset, type SharedPresetView, type StorePresetView } from '@/lib/store-preset-fields';

const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const READY_TTL = 10 * 60 * 1000;
const key = (brand: string, flavor: string) => JSON.stringify([brand, flavor]);
/** Чужие магазины — только опубликованные и не от заблокированных авторов, свои — любые, кроме отклонённых. */
const COPYABLE = `(s."ownerId" = $1 and s.status <> 'rejected') or (s.status = 'published' and not exists(select 1 from "userBlock" b where b."userId" = s."ownerId"))`;

/** Магазины для поля «Скопировать из магазина»: свои первыми, потом город формы и самые полные списки. Пустой запрос — те же первые восемь. */
export async function searchStoresToCopy(userId: string, query: string, city: string, exceptId: string | null): Promise<CopyStoreOption[]> {
  const except = exceptId && UUID.test(exceptId) ? exceptId : null;
  const { rows } = await getPool().query<CopyStoreOption>(`select s.id, s.name, s.address, jsonb_array_length(s.catalog)::int as drinks, s."ownerId" = $1 as own
    from "marketStore" s
    where jsonb_array_length(s.catalog) > 0 and (${COPYABLE}) and ($4::uuid is null or s.id <> $4)
      and position(lower($2) in lower(concat_ws(' ', s.name, s.address))) > 0
    order by s."ownerId" = $1 desc, s.city = $3 desc, jsonb_array_length(s.catalog) desc, s.id limit 8`, [userId, query.trim().slice(0, 80), city, except]);
  return rows;
}

/** Ассортимент выбранного магазина. Сервер сам решает, что отдать: у своего — с ценами, у чужого — только напитки. */
export async function storeAssortment(userId: string, id: string): Promise<StoreClipboard | null> {
  if (!UUID.test(id)) return null;
  const row = (await getPool().query<{ id: string; name: string; catalog: StoreItem[]; own: boolean }>(`select s.id, s.name, s.catalog, s."ownerId" = $1 as own from "marketStore" s where s.id = $2 and (${COPYABLE})`, [userId, id])).rows[0];
  return row?.catalog.length ? copyStoreItems(row, row.catalog, row.own) : null;
}

let readyCache: { at: number; presets: ReadyPreset[] } | null = null;

/** Готовые шаблоны брендов собираются из настоящего наличия: магазины участников и сети с действующими ценами. Считаются раз в 10 минут на процесс. */
export async function readyStorePresets(): Promise<ReadyPreset[]> {
  if (readyCache && Date.now() - readyCache.at < READY_TTL) return readyCache.presets;
  const [options, cities, shelves] = await Promise.all([
    storeDrinkOptions(),
    Promise.all(CITIES.map(city => readCityCatalog(city.id))),
    getPool().query<{ brand: string; flavor: string; stores: number }>(`select i.item->>'brand' as brand, i.item->>'flavor' as flavor, count(distinct s.id)::int as stores
      from "marketStore" s cross join lateral jsonb_array_elements(s.catalog) i(item)
      where s.status = 'published' and i.item ? 'brand' and i.item->>'availability' <> 'unavailable'
        and not exists(select 1 from "userBlock" b where b."userId" = s."ownerId") group by 1, 2`),
  ]);
  const chains = new Map<string, Set<string>>();
  for (const group of await withCardEdits(cities.flatMap(file => activeOffers(file?.groups ?? [])))) {
    const set = chains.get(key(group.brand, group.flavor)) ?? new Set<string>();
    for (const offer of group.variants) set.add(offer.retailer ?? offer.source);
    chains.set(key(group.brand, group.flavor), set);
  }
  const presets = massMarketPresets(options, new Map(shelves.rows.map(row => [key(row.brand, row.flavor), row.stores])), new Map([...chains].map(([id, set]) => [id, set.size])));
  readyCache = { at: Date.now(), presets };
  return presets;
}

export async function listStorePresets(userId: string): Promise<StorePresetView[]> {
  const { rows } = await getPool().query<{ id: string; name: string; items: PresetDrink[]; published: boolean }>('select id, name, items, "publishedAt" is not null as published from "storePreset" where "userId" = $1 order by "createdAt" desc', [userId]);
  return rows.map(row => ({ id: row.id, name: row.name, drinks: row.items, published: row.published }));
}

/** Шаблоны других участников: самые новые, без заблокированных командой авторов и тех, кого заблокировал сам зритель. */
export async function listPublicStorePresets(userId: string): Promise<SharedPresetView[]> {
  const { rows } = await getPool().query<{ id: string; name: string; items: PresetDrink[]; author: string }>(`select p.id, p.name, p.items, u.username as author
    from "storePreset" p join "user" u on u.id = p."userId"
    where p."publishedAt" is not null and p."userId" <> $1 and u.username is not null
      and not exists(select 1 from "userBlock" b where b."userId" = p."userId") and ${notBlockedBy('$1', 'p."userId"')}
    order by p."publishedAt" desc limit $2`, [userId, PUBLIC_PRESETS_SHOWN]);
  return rows.map(row => ({ id: row.id, name: row.name, drinks: row.items, author: row.author }));
}

async function inTransaction(work: (db: PoolClient) => Promise<void>) {
  const db = await getPool().connect();
  try {
    await db.query('begin');
    await work(db);
    await db.query('commit');
  } catch (error) {
    await db.query('rollback');
    throw error;
  } finally {
    db.release();
  }
}

async function lockAuthor(db: PoolClient, userId: string) {
  const row = (await db.query<{ username: string | null }>('select username from "user" where id = $1 for update', [userId])).rows[0];
  if (!row || (await db.query('select 1 from "userBlock" where "userId" = $1', [userId])).rowCount) throw new StoreError('Шаблоны для аккаунта ограничены.');
  return row.username;
}

/** Под опубликованным шаблоном стоит автор, поэтому нужен ник. */
function assertPublishable(username: string | null, drinks: number) {
  if (drinks < MIN_PUBLIC_PRESET_DRINKS) throw new StoreError(`Показать всем можно шаблон от ${MIN_PUBLIC_PRESET_DRINKS} напитков.`);
  if (!username) throw new StoreError('Укажите ник в настройках профиля: под шаблоном будет стоять автор.');
}

/** Создаёт шаблон или правит свой, если передан `id`. Связи с каталогом сверяет сервер, неизвестные становятся своими напитками. */
export async function saveStorePreset(userId: string, nameInput: string, input: unknown, publish = false, id: string | null = null): Promise<void> {
  const name = parsePresetName(nameInput);
  const parsed = parsePresetDrinks(input);
  if (id !== null && !UUID.test(id)) throw new StoreError('Шаблон не найден.');
  const linked = await linkStoreCatalog(presetItems(parsed));
  const drinks: PresetDrink[] = linked.map(({ name: title, brand, flavor }) => ({ name: title, ...(brand !== undefined ? { brand, flavor } : {}) }));
  await inTransaction(async db => {
    const username = await lockAuthor(db, userId);
    if (publish) assertPublishable(username, drinks.length);
    const mine = (await db.query<{ id: string; name: string }>('select id, name from "storePreset" where "userId" = $1', [userId])).rows;
    if (mine.some(row => row.id !== id && row.name.toLocaleLowerCase('ru-RU') === name.toLocaleLowerCase('ru-RU'))) throw new StoreError('Шаблон с таким названием уже есть.');
    if (id !== null) {
      if (!mine.some(row => row.id === id)) throw new StoreError('Шаблон не найден.');
      await db.query(`update "storePreset" set name = $2, items = $3, "publishedAt" = case when $4::boolean then coalesce("publishedAt", now()) end where id = $1`, [id, name, JSON.stringify(drinks), publish]);
      return;
    }
    if (mine.length >= MAX_STORE_PRESETS) throw new StoreError(`Можно сохранить до ${MAX_STORE_PRESETS} шаблонов. Удалите ненужный.`);
    await db.query(`insert into "storePreset" ("userId", name, items, "publishedAt") values ($1, $2, $3, case when $4::boolean then now() end)`, [userId, name, JSON.stringify(drinks), publish]);
  });
}

export async function deleteStorePreset(userId: string, id: string): Promise<void> {
  if (UUID.test(id)) await getPool().query('delete from "storePreset" where id = $1 and "userId" = $2', [id, userId]);
}
