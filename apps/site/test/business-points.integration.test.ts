import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Test DB only');
const pool = new Pool({ connectionString: url, max: 4 });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
vi.mock('@/lib/catalog', () => ({ loadAllCatalogGroups: async () => [] }));
// The geocoder answers by the address: «нигде» is not found, anything else gets a point near the city.
const geo = vi.hoisted(() => ({ calls: [] as string[] }));
vi.mock('@/lib/store-geocoder', () => ({
  hasStoreGeocoder: () => true,
  geocodeStoreAddress: async (city: string, address: string) => { geo.calls.push(`${city}|${address}`); return address.includes('нигде') ? null : { latitude: 55.7 + geo.calls.length / 1000, longitude: 37.6, address, precise: true }; },
  geocodeAnywhere: async (city: string, address: string) => { geo.calls.push(`*${city}|${address}`); return { latitude: 54.19, longitude: 37.61, address, precise: true }; },
}));
const { deletePoint, listBusinessPoints, pointViews, savePoint } = await import('../src/lib/business-points');
const { parsePoint } = await import('../src/lib/business-point-fields');
const { getCompanyProfile } = await import('../src/lib/business-profile');

const [owner, manager, analyst, outsider] = Array.from({ length: 4 }, () => randomUUID()) as [string, string, string, string];
const everyone = [owner, manager, analyst, outsider];
const brand = `Точка ${randomUUID().slice(0, 8)}`;
let companyId = '';
const form = (fields: Record<string, string | string[]>) => {
  const data = new FormData();
  for (const [name, value] of Object.entries({ kind: 'store', city: 'Москва', ...fields })) for (const item of [value].flat()) data.append(name, item);
  return parsePoint(data);
};

beforeAll(async () => {
  for (const id of everyone) await pool.query(`insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt",username) values($1,'Точки',$2,true,now(),now(),$3)`,
    [id, `${id}@example.com`, `bp_${id.slice(0, 12)}`]);
  companyId = (await pool.query<{ id: string }>(`insert into business ("ownerId", name, kind, status) values ($1, 'Точки Лаб', 'brand', 'approved') returning id`, [owner])).rows[0]!.id;
  await pool.query(`insert into "businessMember"("businessId","userId",status,role) values ($1,$2,'active','manager'),($1,$3,'active','analyst')`, [companyId, manager, analyst]);
  await pool.query(`insert into "businessDrink"("businessId",brand,flavor,status) values ($1,$2,'mango','approved'),($1,$2,'cherry','pending')`, [companyId, brand]);
});

afterAll(async () => {
  await pool.query('delete from business where id = $1', [companyId]);
  await pool.query('delete from "user" where id = any($1::text[])', [everyone]);
  await pool.end();
});

it('puts a point on the map by its address, with the company’s approved drinks only', async () => {
  const { id } = await savePoint(manager, null, form({ name: 'Магазин у дома', address: 'ул. Ленина, 12', hours: 'Ежедневно 9–23',
    drink: [JSON.stringify([brand, 'mango']), JSON.stringify([brand, 'cherry']), JSON.stringify(['Чужой', 'mango'])] }));
  const [point] = await listBusinessPoints(companyId);
  expect(point).toMatchObject({ id, name: 'Магазин у дома', city: 'Москва', address: 'ул. Ленина, 12', hours: 'Ежедневно 9–23', drinks: [{ brand, flavor: 'mango' }] });
  expect(geo.calls.at(-1)).toBe('moscow|ул. Ленина, 12');
  const [view] = await pointViews(companyId);
  expect(view!.drinks).toEqual([{ brand, name: 'Манго', href: expect.stringMatching(/^\/catalog\//) }]);
  expect(view!.drinkKeys).toEqual([JSON.stringify([brand, 'mango'])]);
  const log = (await pool.query(`select action, target from "businessAuditLog" where "businessId" = $1 order by "createdAt" desc limit 1`, [companyId])).rows[0];
  expect(log).toEqual({ action: 'point', target: 'Магазин у дома · Москва' });
});

it('looks a city outside the site list up across Russia, and says when an address is not found', async () => {
  await savePoint(owner, null, form({ name: 'Киоск у вокзала', kind: 'kiosk', city: 'Тула', address: 'Привокзальная площадь, 1' }));
  expect(geo.calls.at(-1)).toBe('*Тула|Привокзальная площадь, 1');
  await expect(savePoint(owner, null, form({ name: 'Потерянный', address: 'нигде, 0' }))).rejects.toThrow('Не нашли «нигде, 0» в городе Москва');
  // The same name at the same place is one point.
  await expect(savePoint(owner, null, form({ name: 'киоск у вокзала', kind: 'kiosk', city: 'Тула', address: 'Привокзальная площадь, 1' }))).rejects.toThrow('уже стоит по этому адресу');
});

it('edits without a new lookup when the address stays, and lets only the team’s editors change points', async () => {
  const [point] = (await listBusinessPoints(companyId)).filter(item => item.city === 'Москва');
  const calls = geo.calls.length;
  await savePoint(owner, point!.id, form({ name: 'Магазин у дома', address: 'ул. Ленина, 12', note: 'Холодильник у кассы' }));
  expect(geo.calls.length).toBe(calls);
  expect((await listBusinessPoints(companyId)).find(item => item.id === point!.id)).toMatchObject({ note: 'Холодильник у кассы', drinks: [], latitude: point!.latitude });
  await expect(savePoint(analyst, null, form({ name: 'Аналитик', address: 'ул. Мира, 1' }))).rejects.toThrow('только просмотр');
  await expect(savePoint(outsider, null, form({ name: 'Чужак', address: 'ул. Мира, 1' }))).rejects.toThrow('Сначала расскажите о компании.');
  await expect(deletePoint(analyst, point!.id)).rejects.toThrow('только просмотр');
  // Someone else's point id does nothing to this company.
  await expect(savePoint(owner, randomUUID(), form({ name: 'Нет такой', address: 'ул. Мира, 1' }))).rejects.toThrow('уже удалена');
});

it('shows the points on the public profile, and hides them from visitors when the section is off', async () => {
  expect((await getCompanyProfile(companyId, null))!.points.map(point => point.city).sort()).toEqual(['Москва', 'Тула']);
  await pool.query(`update business set "profileHidden" = '{points}' where id = $1`, [companyId]);
  expect((await getCompanyProfile(companyId, null))!.points).toEqual([]);
  expect((await getCompanyProfile(companyId, owner))!.points).toHaveLength(2);
  await pool.query(`update business set "profileHidden" = '{}' where id = $1`, [companyId]);
  const [first] = await listBusinessPoints(companyId);
  await deletePoint(manager, first!.id);
  expect(await listBusinessPoints(companyId)).toHaveLength(1);
});

it('waits for the company to be approved', async () => {
  await pool.query(`update business set status = 'pending' where id = $1`, [companyId]);
  await expect(savePoint(owner, null, form({ name: 'Рано', address: 'ул. Мира, 1' }))).rejects.toThrow('когда компанию подтвердят');
  await pool.query(`update business set status = 'approved' where id = $1`, [companyId]);
});
