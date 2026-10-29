import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Test DB only');
const pool = new Pool({ connectionString: url, max: 4 });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
vi.mock('react', async original => ({ ...await original<typeof import('react')>(), cache: <T,>(fn: T) => fn }));
const brand = `Профиль ${randomUUID().slice(0, 6)}`;
vi.mock('../src/lib/catalog', () => ({ loadAllCatalogGroups: async () => [{ brand, flavor: 'mango', variants: [], minPrice: 0, coverImageUrl: '/mango.jpg' }] }));
const profile = await import('../src/lib/business-profile');

const [owner, manager, analyst, visitor] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
let businessId = '', storeId = '';
const pdf = Buffer.from('%PDF-1.7\n1 0 obj << >> endobj\n%%EOF');

beforeAll(async () => {
  for (const id of [owner, manager, analyst, visitor]) await pool.query(
    `insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt",username) values($1,'Company test',$2,true,now(),now(),$3)`, [id, `${id}@example.com`, `cp_${id.slice(0, 12)}`]);
  businessId = (await pool.query<{ id: string }>(`insert into business("ownerId", name, kind) values ($1, $2, 'brand') returning id`, [owner, brand])).rows[0]!.id;
  await pool.query(`insert into "businessMember"("businessId", "userId", status, role) values ($1, $2, 'active', 'manager'), ($1, $3, 'active', 'analyst')`, [businessId, manager, analyst]);
  await pool.query(`insert into "businessDrink"("businessId", brand, flavor, status) values ($1, $2, 'mango', 'approved')`, [businessId, brand]);
  storeId = (await pool.query<{ id: string }>(`insert into "marketStore"("ownerId", name, city, address, latitude, longitude, "locationSource", status) values ($1, $2, 'Москва', 'Тверская, 1', 55.75, 37.6, 'manual', 'published') returning id`, [manager, `${brand} store`])).rows[0]!.id;
});
afterAll(async () => {
  await pool.query('delete from "user" where id = any($1::text[])', [[owner, manager, analyst, visitor]]);
  await pool.end();
});

it('is public once approved; before that only the team sees it', async () => {
  expect(await profile.getCompanyProfile(businessId, visitor)).toBeNull();
  expect((await profile.getCompanyProfile(businessId, analyst))?.role).toBe('analyst');
  await expect(profile.createCompanyPost(owner, 'Рано', null)).rejects.toThrow('подтвердят');
  await pool.query(`update business set status = 'approved' where id = $1`, [businessId]);
  const page = await profile.getCompanyProfile(businessId, null);
  expect(page?.role).toBeNull();
  expect(page?.drinks).toEqual([{ brand, flavor: 'mango', name: 'Манго', cover: '/mango.jpg', href: expect.stringContaining('/catalog/') }]);
  expect(await profile.getCompanyProfile('not-a-uuid', null)).toBeNull();
});

it('lets the owner and managers pin PDF presentations, checked by content', async () => {
  await expect(profile.createCompanyPost(analyst, 'Нельзя', null)).rejects.toThrow('владелец и менеджеры');
  await expect(profile.createCompanyPost(manager, '', { name: 'fake.pdf', data: Buffer.from('<html>') })).rejects.toThrow('Это не PDF');
  await expect(profile.createCompanyPost(manager, '', null)).rejects.toThrow('текст, фото или PDF');
  // A news post with photos alone: stored in order, served while the company is public, gone with the post.
  const tiny = { data: Buffer.from('webp'), thumbnail: Buffer.from('thumb') };
  const news = await profile.createCompanyPost(manager, '', null, [tiny, { ...tiny, data: Buffer.from('second') }]);
  const [withPhotos] = await profile.listCompanyPosts(businessId);
  expect(withPhotos).toMatchObject({ id: news, text: '', photos: [expect.any(String), expect.any(String)] });
  expect((await profile.getCompanyPostPhoto(withPhotos!.photos[1]!, null, false))?.toString()).toBe('second');
  expect((await profile.getCompanyPostPhoto(withPhotos!.photos[0]!, null, true))?.toString()).toBe('thumb');
  await expect(profile.createCompanyPost(manager, '', null, Array(5).fill(tiny))).rejects.toThrow('4 фото');
  await profile.deleteCompanyPost(manager, news);
  expect(await profile.getCompanyPostPhoto(withPhotos!.photos[0]!, null, false)).toBeNull();
  await pool.query(`delete from "businessAuditLog" where "businessId" = $1`, [businessId]);
  const id = await profile.createCompanyPost(manager, 'Линейка 2027', { name: '../Deck.pdf', data: pdf });
  const [post] = await profile.listCompanyPosts(businessId);
  expect(post).toMatchObject({ id, text: 'Линейка 2027', fileName: 'Deck.pdf', fileSize: pdf.length });
  expect((await profile.getCompanyPostFile(id, null))?.data.equals(pdf)).toBe(true);
  expect((await pool.query(`select action from "businessAuditLog" where "businessId" = $1`, [businessId])).rows).toEqual([{ action: 'post' }]);
  // A company that loses its approval hides its files from visitors.
  await pool.query(`update business set status = 'pending' where id = $1`, [businessId]);
  expect(await profile.getCompanyPostFile(id, visitor)).toBeNull();
  expect(await profile.getCompanyPostFile(id, manager)).not.toBeNull();
  await pool.query(`update business set status = 'approved' where id = $1`, [businessId]);
  // The newest PDF fills the «Презентация» block until the team pins one; a text post cannot be pinned.
  const text = await profile.createCompanyPost(manager, 'Без файла', null);
  const newer = await profile.createCompanyPost(owner, '', { name: 'Newer.pdf', data: pdf });
  expect((await profile.getCompanyProfile(businessId, null))?.presentation).toMatchObject({ id: newer, pinned: false });
  await expect(profile.pinCompanyPresentation(manager, text)).rejects.toThrow('PDF');
  await expect(profile.pinCompanyPresentation(analyst, id)).rejects.toThrow('владелец и менеджеры');
  await profile.pinCompanyPresentation(manager, id);
  expect((await profile.getCompanyProfile(businessId, null))?.presentation).toMatchObject({ id, pinned: true, fileName: 'Deck.pdf' });
  // Deleting the pinned post unpins it: the newest PDF comes back.
  await profile.deleteCompanyPost(owner, id);
  expect((await profile.getCompanyProfile(businessId, null))?.presentation).toMatchObject({ id: newer, pinned: false });
  for (const post of [text, newer]) await profile.deleteCompanyPost(owner, post);
  expect(await profile.listCompanyPosts(businessId)).toEqual([]);
});

it('leads to a team store and hides the sections the owner switched off', async () => {
  const business = (await pool.query(`select * from business where id = $1`, [businessId])).rows[0];
  expect((await profile.companyStoreOptions(business)).map(store => store.id)).toEqual([storeId]);
  await expect(profile.saveCompanyProfile(manager, storeId, [])).rejects.toThrow('владелец');
  await expect(profile.saveCompanyProfile(owner, randomUUID(), [])).rejects.toThrow('магазин');
  await profile.saveCompanyProfile(owner, storeId, ['drinks']);
  const page = await profile.getCompanyProfile(businessId, visitor);
  expect(page?.store).toMatchObject({ id: storeId, city: 'Москва' });
  expect(page?.drinks).toEqual([]);
  expect(page?.business.profileHidden).toEqual(['drinks']);
});

it('lets members subscribe and tells subscribers about new posts; the owner sets a banner', async () => {
  const { getNotifications } = await import('../src/lib/notifications');
  expect(await profile.setCompanyFollow(visitor, businessId, true)).toBe(1);
  expect(await profile.setCompanyFollow(visitor, businessId, true)).toBe(1);
  expect(await profile.getCompanyProfile(businessId, visitor)).toMatchObject({ followers: 1, following: true });
  const post = await profile.createCompanyPost(manager, 'Новый вкус уже в продаже', null);
  expect((await getNotifications(visitor)).items[0]).toMatchObject({ kind: 'company-post', title: `${brand}: новая публикация`, detail: 'Новый вкус уже в продаже', href: `/company/${businessId}` });
  // The author is not told about their own post, even when subscribed.
  await profile.setCompanyFollow(manager, businessId, true);
  await profile.createCompanyPost(manager, 'Ещё одна', null);
  expect((await getNotifications(manager)).items.filter(item => item.kind === 'company-post')).toEqual([]);
  expect(await profile.setCompanyFollow(visitor, businessId, false)).toBe(1);
  await expect(profile.setCompanyFollow(visitor, randomUUID(), true)).rejects.toThrow('не найдена');

  const info = { bio: 'Энергия. Люди. Культура.', story: 'Длинная история бренда', publicEmail: 'hello@brand.ru', phone: '+7 495 123-45-67', address: 'Москва' };
  await expect(profile.saveCompanyInfo(manager, info)).rejects.toThrow('владелец');
  await profile.saveCompanyInfo(owner, info);
  expect((await profile.getCompanyProfile(businessId, null))!.business).toMatchObject(info);
  await expect(profile.setCompanyBanner(manager, Buffer.from('x'))).rejects.toThrow('владелец');
  await profile.setCompanyBanner(owner, Buffer.from('banner-1'));
  await profile.setCompanyBanner(owner, Buffer.from('banner-2'));
  const bannerId = (await profile.getCompanyProfile(businessId, null))!.business.bannerId!;
  expect((await profile.getCompanyBanner(bannerId))?.toString()).toBe('banner-2');
  expect((await pool.query(`select count(*)::int as n from "businessBanner" where "businessId" = $1`, [businessId])).rows[0].n).toBe(1);
  await profile.setCompanyBanner(owner, null);
  expect((await profile.getCompanyProfile(businessId, null))!.business.bannerId).toBeNull();
  for (const id of [post]) await profile.deleteCompanyPost(owner, id);
});

it('gives a drink page its company card: the confirmed company, its drinks and the viewer’s subscription', async () => {
  expect(await profile.drinkCompanyId(brand, 'mango')).toBe(businessId);
  expect(await profile.drinkCompanyId(brand, 'cola')).toBeNull();
  await pool.query(`insert into "businessFollow"("businessId", "userId") values ($1, $2) on conflict do nothing`, [businessId, visitor]);
  const card = await profile.getCompanyCard(businessId, visitor);
  expect(card).toMatchObject({ id: businessId, name: brand, kind: 'brand', drinks: 1, following: true });
  expect(card!.followers).toBeGreaterThanOrEqual(1);
  expect((await profile.getCompanyCard(businessId, null))?.following).toBe(false);
  await pool.query(`update business set status = 'rejected' where id = $1`, [businessId]);
  expect(await profile.getCompanyCard(businessId, null)).toBeNull();
  expect(await profile.drinkCompanyId(brand, 'mango')).toBeNull();
  await pool.query(`update business set status = 'approved' where id = $1`, [businessId]);
});
