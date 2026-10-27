import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Test DB only');
const pool = new Pool({ connectionString: url, max: 4 });
const brand = `Biz ${randomUUID().slice(0, 8)}`;
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
vi.mock('../src/lib/store-catalog', () => ({ storeDrinkOptions: async () => [{ brand, flavor: 'mango', label: `${brand} · mango` }, { brand, flavor: 'peach', label: `${brand} · peach` }] }));
vi.mock('../src/lib/catalog', () => ({ loadAllCatalogGroups: async () => [{ brand, flavor: 'mango', variants: [], minPrice: 0 }, { brand, flavor: 'peach', variants: [], minPrice: 0 }] }));
const business = await import('../src/lib/business');
const { parseBusinessInput } = await import('../src/lib/business-fields');

const owner = randomUUID(), fan = randomUUID(), staff = randomUUID();
const staffEmail = `${staff}@example.com`;
const input = (name: string) => { const form = new FormData(); form.set('name', name); form.set('kind', 'brand'); return parseBusinessInput(form); };

beforeAll(async () => {
  for (const id of [owner, fan, staff]) await pool.query(
    `insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt",username) values($1,'Business test',$2,true,now(),now(),$3)`, [id, `${id}@example.com`, `bz_${id.slice(0, 12)}`]);
  await pool.query(`insert into "siteAdmin"(email, role) values ($1, 'moderator')`, [staffEmail]);
});
afterAll(async () => {
  await pool.query('delete from review where brand = $1', [brand]);
  await pool.query('delete from "businessReviewDigest" where brand = $1', [brand]);
  await pool.query(`delete from "telegramJobRun" where job like 'business-digest:' || $1 || ':%'`, [brand]);
  await pool.query(`delete from "searchQuery" where brands && array[$1]::text[] or strpos(query, lower($1)) > 0`, [brand]);
  await pool.query('delete from "drinkSwipe" where brand = $1', [brand]);
  await pool.query('delete from "adminAuditLog" where "adminEmail" = $1', [staffEmail]);
  await pool.query('delete from "siteAdmin" where email = $1', [staffEmail]);
  await pool.query('delete from notification where "userId" = any($1::text[])', [[owner, fan, staff]]);
  await pool.query('delete from "user" where id = any($1::text[])', [[owner, fan, staff]]);
  await pool.end();
});

it('applies, attaches drinks through moderation and counts only approved ones', async () => {
  await business.saveBusiness(owner, input('Energy Lab'));
  const company = (await business.getOwnBusiness(owner))!;
  expect(company).toMatchObject({ name: 'Energy Lab', status: 'pending' });
  await business.requestBusinessDrink(owner, brand, 'mango');
  await business.requestBusinessDrink(owner, brand, 'peach');
  await expect(business.requestBusinessDrink(owner, brand, 'mango')).rejects.toThrow('уже прикреплён');
  await expect(business.requestBusinessDrink(owner, brand, 'cola')).rejects.toThrow('нет в каталоге');
  // Only the team decides, and a refusal of a company needs a reason.
  await expect(business.moderateBusiness(fan, company.id, 'approved', '')).rejects.toThrow('команда');
  await expect(business.moderateBusiness(staff, company.id, 'rejected', ' ')).rejects.toThrow('причину');
  await business.moderateBusiness(staff, company.id, 'approved', '');
  await business.moderateBusinessDrink(staff, company.id, brand, 'mango', 'approved', '');
  await business.moderateBusinessDrink(staff, company.id, brand, 'peach', 'rejected', 'Не ваш вкус');

  await pool.query(`insert into review("userId", brand, flavor, design, taste, text) values ($1, $2, 'mango', 8, 6, 'Сочный'), ($1, $2, 'peach', 2, 2, 'Не то')`, [fan, brand]);
  await pool.query(`insert into "drinkSwipe"("userId", brand, flavor, liked) values ($1, $2, 'mango', true), ($3, $2, 'peach', false)`, [fan, brand, owner]);
  const analytics = await business.getBusinessAnalytics(company.id);
  expect(analytics.drinks).toBe(1);
  expect(analytics.reviews).toMatchObject({ total: 1, last30: 1, taste: 6, design: 8 });
  expect(analytics.reviews.scores[6]).toBe(1);
  expect(analytics.reviews.weekly.at(-1)!.count).toBe(1);
  // The brand block covers every drink of the brand, approved or not.
  expect(analytics.brand).toMatchObject({ reviews: 2, likes: 1, skips: 1, catalogDrinks: 2 });
  expect((await business.listBusinessReviews(company.id)).items.map(item => item.text)).toEqual(['Сочный']);
  expect((await business.listBusinessReviews(company.id, { q: 'сочн' })).total).toBe(1);
  expect((await business.listBusinessReviews(company.id, { q: 'горький' })).total).toBe(0);
  const brandDrinks = await business.listBrandDrinks(company.id, [brand]);
  expect(brandDrinks.map(item => [item.flavor, item.yours, item.reviews])).toEqual([['mango', true, 1], ['peach', false, 1]]);
  const drinks = await business.listBusinessDrinks(company.id);
  expect(drinks.map(item => [item.flavor, item.status, item.reviews])).toEqual([['mango', 'approved', 1], ['peach', 'rejected', 1]]);
  expect(drinks[1]!.moderationNote).toBe('Не ваш вкус');
  // GigaChat's brief: needs 3 reviews, then is written once and refreshed only after new reviews.
  const answers: string[] = [];
  const fake = { model: 'GigaChat-test', chat: async (messages: { content: string }[]) => { answers.push(messages[1]!.content); return '{"summary":"Хвалят вкус.","sentiment":"positive","praise":["сочный"],"complaints":[],"suggestions":[]}'; } };
  const client = fake as unknown as Parameters<typeof business.generateDrinkDigest>[3];
  await expect(business.generateDrinkDigest(owner, brand, 'mango', client)).rejects.toThrow('хотя бы 3');
  await pool.query(`insert into review("userId", brand, flavor, design, taste, text) values ($1, $2, 'mango', 9, 9, 'Топ'), ($3, $2, 'mango', 7, 8, 'Норм')`, [owner, brand, staff]);
  await expect(business.generateDrinkDigest(fan, brand, 'mango', client)).rejects.toThrow('подтверждённой компании');
  // The cabinet writes due briefs by itself (no button): once, and not again without new reviews.
  expect(business.digestDue((await business.listDrinkDigests(company.id))[0]!)).toBe(true);
  expect(await business.refreshBusinessDigests(company.id, await business.listDrinkDigests(company.id), client)).toBe(1);
  expect(await business.refreshBusinessDigests(company.id, await business.listDrinkDigests(company.id), client)).toBe(0);
  expect(answers).toHaveLength(1);
  expect(answers[0]).not.toContain('bz_');
  await expect(business.generateDrinkDigest(owner, brand, 'mango', client)).rejects.toThrow('Новых отзывов');
  const digests = await business.listDrinkDigests(company.id);
  expect(digests[0]).toMatchObject({ flavor: 'mango', reviews: 3, fresh: 0, digest: { reviewCount: 3, model: 'GigaChat-test' } });
  await expect(business.generateDrinkDigest(owner, brand, 'mango', null)).rejects.toThrow('не подключён');
  // A rejected drink can be sent again; removing one is the owner's own business.
  await business.requestBusinessDrink(owner, brand, 'peach');
  await business.removeBusinessDrink(owner, brand, 'peach');
  expect((await business.listBusinessDrinks(company.id)).map(item => item.flavor)).toEqual(['mango']);
});

it('invites a team member, notifies about new reviews and keeps one logo', async () => {
  const company = (await business.getOwnBusiness(owner))!;
  const fanName = `bz_${fan.slice(0, 12)}`;
  await expect(business.inviteBusinessMember(fan, fanName)).rejects.toThrow('только владелец');
  await expect(business.inviteBusinessMember(owner, '@nobody_here_123')).rejects.toThrow('нет');
  await business.inviteBusinessMember(owner, `@${fanName}`);
  await expect(business.inviteBusinessMember(owner, fanName)).rejects.toThrow('уже в команде');
  expect((await pool.query(`select payload->>'business' as name from notification where "userId" = $1 and kind = 'business-invite'`, [fan])).rows[0]?.name).toBe('Energy Lab');
  expect(await business.getCabinet(fan)).toBeNull();
  expect((await business.listBusinessInvites(fan)).map(invite => invite.business)).toEqual(['Energy Lab']);
  await business.answerBusinessInvite(fan, company.id, true);
  expect(await business.getCabinet(fan)).toMatchObject({ role: 'manager', business: { id: company.id } });

  // A new review of an approved drink reaches the owner and the team, not its author; switched off — nothing.
  await pool.query(`delete from review where "userId" = $1 and brand = $2 and flavor = 'mango'`, [staff, brand]);
  await pool.query(`insert into "notificationPreference"("userId", kind, enabled) values ($1, 'business-review', false)`, [fan]);
  const review = (await pool.query<{ id: string }>(`insert into review("userId", brand, flavor, design, taste, text) values ($1, $2, 'mango', 7, 7, 'Неплохо') returning id`, [staff, brand])).rows[0]!;
  const notified = (await pool.query<{ userId: string }>(`select "userId" from notification where kind = 'business-review' and "reviewId" = $1`, [review.id])).rows.map(row => row.userId);
  expect(notified).toEqual([owner]);

  const first = await business.setBusinessLogo(owner, Buffer.from('logo-1'));
  const second = await business.setBusinessLogo(owner, Buffer.from('logo-2'));
  expect(await business.getBusinessLogo(first)).toBeNull();
  expect((await business.getBusinessLogo(second))?.toString()).toBe('logo-2');
  expect((await business.getOwnBusiness(owner))?.logoId).toBe(second);
  await expect(business.setBusinessLogo(fan, Buffer.from('x'))).rejects.toThrow('только владелец');

  await business.leaveBusiness(fan);
  expect(await business.getCabinet(fan)).toBeNull();

  // By email (the main way): a letter goes out; the list shows only the address until it is accepted.
  const letters: string[] = [];
  const mail = async (to: string) => { letters.push(to); };
  await business.removeBusinessMember(owner, `user:${fan}`);
  expect(await business.inviteBusinessMember(owner, `${fan}@EXAMPLE.com`, mail)).toBe('email');
  const fresh = `new-${randomUUID().slice(0, 8)}@example.com`;
  expect(await business.inviteBusinessMember(owner, fresh, mail)).toBe('email');
  expect(letters).toEqual([`${fan}@example.com`, fresh]);
  await expect(business.inviteBusinessMember(owner, fresh, mail)).rejects.toThrow('уже отправлено');
  await expect(business.inviteBusinessMember(owner, 'not-an-email@', mail)).rejects.toThrow('адрес почты');
  const team = await business.listBusinessMembers(company.id);
  expect(team.map(member => [member.name, member.username, member.status])).toEqual([[`${fan}@example.com`, null, 'pending'], [fresh, null, 'pending']]);
  // Someone signing up with the invited address finds the invitation in the cabinet.
  const later = randomUUID();
  await pool.query(`insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt",username) values($1,'Later',$2,true,now(),now(),$3)`, [later, fresh, `bz_${later.slice(0, 12)}`]);
  expect((await business.listBusinessInvites(later)).map(invite => invite.business)).toEqual(['Energy Lab']);
  await business.answerBusinessInvite(later, company.id, true);
  expect(await business.getCabinet(later)).toMatchObject({ role: 'manager' });
  await business.removeBusinessMember(owner, `email:${fresh}`);
  await pool.query('delete from "user" where id = $1', [later]);
});

it('counts searches with the brand and lets the company answer a review', async () => {
  const company = (await business.getOwnBusiness(owner))!;
  const name = brand.toLowerCase();
  // Anonymous search log: shown in results, named in the query, named but found nothing, and an unrelated search.
  await pool.query(`insert into "searchQuery"(query, scope, results, brands) values
    ('манго', 'catalog', 5, array[$1]::text[]), ($2 || ' манго', 'catalog', 1, array[$1]::text[]),
    ($2 || ' юдзу', 'market', 0, '{}'), ($2 || ' юдзу', 'stores', 0, '{}'), ('совсем другое', 'catalog', 3, '{}')`, [brand, name]);
  const search = await business.getBusinessSearch(company.id);
  expect(search).toMatchObject({ brands: [brand], total30: 4, shown30: 2, named30: 3, missed30: 2 });
  expect(search.missed).toEqual([expect.objectContaining({ query: `${name} юдзу`, count: 2 })]);
  expect(search.top.find(item => item.query === `${name} юдзу`)).toMatchObject({ named: true, results: 0, scopes: ['market', 'stores'] });
  expect(search.top.some(item => item.query === 'совсем другое')).toBe(false);

  // A reply under a review of the company's approved drink; its author hears about it once.
  const author = randomUUID();
  await pool.query(`insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt",username) values($1,'Author',$2,true,now(),now(),$3)`, [author, `${author}@example.com`, `bz_${author.slice(0, 12)}`]);
  const review = (await pool.query<{ id: string }>(`insert into review("userId", brand, flavor, design, taste, text) values ($1, $2, 'mango', 6, 5, 'Мало газа') returning id`, [author, brand])).rows[0]!.id;
  await expect(business.replyToReview(author, review, 'Я не компания')).rejects.toThrow('подтверждённая компания');
  await expect(business.replyToReview(owner, review, '   ')).rejects.toThrow('Напишите ответ');
  await business.replyToReview(owner, review, '  Спасибо!   Учтём   газ.  ');
  const reply = (await pool.query<{ text: string; businessId: string }>(`select text, "businessId" from "reviewCompanyReply" where "reviewId" = $1`, [review])).rows[0];
  expect(reply).toEqual({ text: 'Спасибо! Учтём газ.', businessId: company.id });
  expect((await pool.query<{ business: string }>(`select payload->>'business' as business from notification where "userId" = $1 and kind = 'business-reply'`, [author])).rows).toEqual([{ business: 'Energy Lab' }]);
  expect((await business.listBusinessReviews(company.id, { q: 'Мало газа' })).items[0]?.reply?.text).toBe('Спасибо! Учтём газ.');
  // Editing keeps one reply and does not notify again; deleting takes it down.
  await business.replyToReview(owner, review, 'Спасибо! Газ добавим в новой партии.');
  expect((await pool.query(`select 1 from notification where "userId" = $1 and kind = 'business-reply'`, [author])).rowCount).toBe(1);
  await business.deleteReviewReply(owner, review);
  expect((await pool.query(`select 1 from "reviewCompanyReply" where "reviewId" = $1`, [review])).rowCount).toBe(0);
  await pool.query('delete from notification where "userId" = $1', [author]);
  await pool.query('delete from review where id = $1', [review]);
  await pool.query('delete from "user" where id = $1', [author]);
});
