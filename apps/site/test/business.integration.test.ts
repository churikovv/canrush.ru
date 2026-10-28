import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Test DB only');
const pool = new Pool({ connectionString: url, max: 4 });
const brand = `Biz ${randomUUID().slice(0, 8)}`;
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
vi.mock('../src/lib/store-catalog', () => ({ storeDrinkOptions: async () => [{ brand, flavor: 'mango', label: `${brand} · mango` }, { brand, flavor: 'peach', label: `${brand} · peach` }] }));
const rival = `${brand} Rival`;
vi.mock('../src/lib/catalog', () => ({ loadAllCatalogGroups: async () => [{ brand, flavor: 'mango', variants: [], minPrice: 0 }, { brand, flavor: 'peach', variants: [], minPrice: 0 },
  { brand: rival, flavor: 'mango', variants: [{ price: 120, volumeMl: 250 }, { price: 200, volumeMl: 500 }], minPrice: 120 }] }));
const business = await import('../src/lib/business');
const { parseBusinessInput } = await import('../src/lib/business-fields');

const owner = randomUUID(), fan = randomUUID(), staff = randomUUID();
const staffEmail = `${staff}@example.com`;
const admin = randomUUID();
const adminEmail = `${admin}@example.com`;
const input = (name: string) => { const form = new FormData(); form.set('name', name); form.set('kind', 'brand'); return parseBusinessInput(form); };

beforeAll(async () => {
  for (const id of [owner, fan, staff, admin]) await pool.query(
    `insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt",username) values($1,'Business test',$2,true,now(),now(),$3)`, [id, `${id}@example.com`, `bz_${id.slice(0, 12)}`]);
  await pool.query(`insert into "siteAdmin"(email, role) values ($1, 'moderator'), ($2, 'admin')`, [staffEmail, adminEmail]);
});
afterAll(async () => {
  await pool.query('delete from review where brand = any($1::text[])', [[brand, rival]]);
  await pool.query('delete from "businessReviewDigest" where brand = $1', [brand]);
  await pool.query(`delete from "telegramJobRun" where job like 'business-digest:' || $1 || ':%'`, [brand]);
  await pool.query(`delete from "searchQuery" where brands && array[$1]::text[] or strpos(query, lower($1)) > 0`, [brand]);
  await pool.query('delete from "drinkSwipe" where brand = $1', [brand]);
  await pool.query('delete from "catalogEvent" where brand = $1', [brand]);
  await pool.query('delete from "brandDrinkProfile" where brand = $1', [brand]);
  // Before the users: deleting the owner (its company) and the admin (the edit's reviewer) in one statement cascades
  // into the same edit rows in an order that sometimes trips the company key.
  await pool.query('delete from "brandDrinkEdit" where brand = $1', [brand]);
  await pool.query(`delete from "adminAuditLog" where "adminEmail" = $1`, [adminEmail]);
  await pool.query('delete from "siteAdmin" where email = $1', [adminEmail]);
  await pool.query(`delete from "marketListing" where "sellerId" = any($1::text[])`, [[owner, fan]]);
  await pool.query('delete from "adminAuditLog" where "adminEmail" = $1', [staffEmail]);
  await pool.query('delete from "siteAdmin" where email = $1', [staffEmail]);
  await pool.query('delete from notification where "userId" = any($1::text[])', [[owner, fan, staff]]);
  await pool.query('delete from "user" where id = any($1::text[])', [[owner, fan, staff, admin]]);
  await pool.end();
});

it('applies, attaches drinks through moderation and counts only approved ones', async () => {
  await expect(business.saveBusiness(owner, input('Energy Lab'), null)).rejects.toThrow('условия');
  await business.saveBusiness(owner, input('Energy Lab'), '2026-10-28');
  expect((await pool.query(`select "termsVersion", "termsAcceptedAt" is not null as accepted from business where "ownerId" = $1`, [owner])).rows[0]).toEqual({ termsVersion: '2026-10-28', accepted: true });
  const company = (await business.getOwnBusiness(owner))!;
  expect(company).toMatchObject({ name: 'Energy Lab', status: 'pending' });
  await business.requestBusinessDrink(owner, brand, 'mango');
  await business.requestBusinessDrink(owner, brand, 'peach');
  await expect(business.requestBusinessDrink(owner, brand, 'mango')).rejects.toThrow('уже прикреплён');
  await expect(business.requestBusinessDrink(owner, brand, 'cola')).rejects.toThrow('нет в каталоге');
  // Only the team decides, and a refusal of a company needs a reason.
  await expect(business.moderateBusiness(fan, company.id, 'approved', '')).rejects.toThrow('команда');
  await expect(business.moderateBusiness(staff, company.id, 'rejected', ' ')).rejects.toThrow('причину');
  const approvedMail = vi.fn(async () => undefined);
  await business.moderateBusiness(staff, company.id, 'approved', '', approvedMail);
  expect((approvedMail.mock.calls[0] as unknown[]).slice(0, 2)).toEqual([`${owner}@example.com`, 'Energy Lab']);
  // The analytics below needs a paid plan; the pilot depends on how many founders the test database already has.
  await pool.query(`update business set plan = 'brand', "planUntil" = now() + interval '30 days' where id = $1`, [company.id]);
  // Approving again (an edit of the decision) sends nothing new.
  await business.moderateBusiness(staff, company.id, 'approved', '', approvedMail);
  expect(approvedMail).toHaveBeenCalledTimes(1);
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

it('counts drink card views and store taps of approved drinks', async () => {
  const company = (await business.getOwnBusiness(owner))!;
  // mango is the company's approved drink; peach is not, so its events stay out.
  await pool.query(`insert into "catalogEvent"(brand, flavor, kind, retailer, "createdAt") values
    ($1, 'mango', 'view', null, now()), ($1, 'mango', 'view', null, now()), ($1, 'mango', 'view', null, now()), ($1, 'mango', 'view', null, now()),
    ($1, 'mango', 'store', 'Лента', now()), ($1, 'mango', 'store', 'Лента', now()), ($1, 'mango', 'store', 'Магнит', now()),
    ($1, 'mango', 'view', null, now() - interval '40 days'), ($1, 'peach', 'view', null, now())`, [brand]);
  const cards = await business.getBusinessCards(company.id);
  expect(cards).toMatchObject({ views30: 4, previousViews30: 1, clicks30: 3, previousClicks30: 0 });
  expect(cards.items.find(item => item.flavor === 'mango')).toMatchObject({ views: 4, clicks: 3, retailer: 'Лента' });
  expect(cards.items.some(item => item.flavor === 'peach')).toBe(false);
  expect(cards.retailers).toEqual([{ retailer: 'Лента', count: 2 }, { retailer: 'Магнит', count: 1 }]);
  expect(cards.weekly.reduce((sum, week) => sum + week.count, 0)).toBe(5);
});

it('publishes a listing on behalf of the approved company only for its team', async () => {
  const market = await import('../src/lib/market');
  const company = (await business.getOwnBusiness(owner))!;
  const photo = { data: Buffer.from('test'), thumbnail: Buffer.from('thumb') };
  const lot = { title: 'Лимитка', description: 'Шесть банок', city: 'Москва', price: 15000, quantity: 6, delivery: ['pickup' as const] };
  await expect(market.createListing(fan, lot, [photo], company.id)).rejects.toThrow('менеджерам команды');
  const id = await market.createListing(owner, lot, [photo], company.id);
  expect(await market.getListing(id)).toMatchObject({ sellerId: owner, businessId: company.id, businessName: 'Energy Lab' });
  expect((await market.getCabinetListings(fan, company.id)).map(item => item.id)).toContain(id);
  expect((await market.getCabinetListings(fan, null)).map(item => item.id)).not.toContain(id);
});

it('compares the company with competitor brands', async () => {
  const competitors = await import('../src/lib/business-competitors');
  const company = (await business.getOwnBusiness(owner))!;
  await expect(competitors.addCompetitor(company.id, brand)).rejects.toThrow('ваш бренд');
  await expect(competitors.addCompetitor(company.id, 'Нет такого')).rejects.toThrow('из каталога');
  await competitors.addCompetitor(company.id, rival.toUpperCase());
  await expect(competitors.addCompetitor(company.id, rival)).rejects.toThrow('уже в сравнении');
  await pool.query(`insert into review("userId", brand, flavor, design, taste, text) values ($1, $2, 'mango', 9, 9, 'Отлично')`, [fan, rival]);
  const data = await competitors.getCompetitors(company.id);
  expect(data.picked).toEqual([rival]);
  expect(data.options).toEqual([rival]);
  // Brand-wide: every review and card view of the brand, not only the approved drink.
  const own = (await pool.query<{ reviews: number; views: number }>(`select (select count(*)::int from review where brand = $1) as reviews,
    (select count(*)::int from "catalogEvent" where brand = $1 and kind = 'view' and "createdAt" > now() - interval '30 days') as views`, [brand])).rows[0]!;
  expect(data.own).toMatchObject({ label: brand, own: true, drinks: 2, reviews: own.reviews, views30: own.views, clicks30: 3 });
  expect(data.rivals[0]).toMatchObject({ label: rival, own: false, drinks: 1, reviews: 1, score: 9, price500: 220 });
});

it('builds the weekly report and sends it once per member', async () => {
  const report = await import('../src/lib/business-report');
  const { moscowDay } = await import('../src/lib/drink-calendar-fields');
  const company = (await business.getOwnBusiness(owner))!;
  expect(report.reportedWeek('2026-11-02')).toBe('2026-10-26');
  expect(report.reportedWeek('2026-11-08')).toBe('2026-10-26');
  // The week running now, so the rows written by the tests above fall into it.
  const monday = new Date(`${report.reportedWeek(moscowDay())}T00:00:00Z`); monday.setUTCDate(monday.getUTCDate() + 7);
  const week = monday.toISOString().slice(0, 10);
  const data = (await report.getWeeklyReport(company.id, week))!;
  // Reviews of the approved drink only (mango), written by the tests above this week.
  const mango = (await pool.query<{ count: number; score: number; all: number; views: number }>(`select count(*) filter (where flavor = 'mango')::int as count,
    round(avg((taste + design) / 2.0) filter (where flavor = 'mango')::numeric, 1)::float8 as score, count(*)::int as all,
    (select count(*)::int from "catalogEvent" where brand = $1 and kind = 'view' and "createdAt" > now() - interval '1 day') as views from review where brand = $1`, [brand])).rows[0]!;
  expect(data).toMatchObject({ business: 'Energy Lab', from: week, reviews: { now: mango.count, before: 0, score: mango.score }, views: { now: 4 }, clicks: { now: 3 } });
  expect(data.latest.length).toBe(Math.min(3, mango.count));
  expect(data.latest.every(item => item.drink.includes(brand))).toBe(true);
  expect(data.rivals).toEqual([{ label: brand, own: true, reviews: mango.all, views: mango.views }, { label: rival, own: false, reviews: 1, views: 0 }]);

  const send = vi.fn(async () => undefined);
  try {
    await report.runWeeklyReports(week, send, 0);
    const mine = send.mock.calls.filter(call => (call as unknown[])[0] === `${owner}@example.com`);
    expect(mine).toHaveLength(1);
    await report.runWeeklyReports(week, send, 0);
    expect(send.mock.calls.filter(call => (call as unknown[])[0] === `${owner}@example.com`)).toHaveLength(1);
    // Turned off: nothing next time.
    await pool.query(`delete from "businessWeeklyReport" where week = $1`, [week]);
    await pool.query(`insert into "businessReportOptOut"("userId") values ($1)`, [owner]);
    send.mockClear();
    await report.runWeeklyReports(week, send, 0);
    expect(send.mock.calls.some(call => (call as unknown[])[0] === `${owner}@example.com`)).toBe(false);
  } finally {
    await pool.query(`delete from "businessWeeklyReport" where week = $1`, [week]);
    await pool.query(`delete from "businessReportOptOut" where "userId" = $1`, [owner]);
  }
});

it('keeps reply templates for the whole team', async () => {
  const company = (await business.getOwnBusiness(owner))!;
  await expect(business.saveReplyTemplate(fan, 'Чужой', 'Текст')).rejects.toThrow('подтверждённой компании');
  const saved = await business.saveReplyTemplate(owner, ' Спасибо ', 'Спасибо, {автор}! Рады, что {напиток} зашёл.');
  expect(saved).toMatchObject({ title: 'Спасибо', text: 'Спасибо, {автор}! Рады, что {напиток} зашёл.' });
  await expect(business.saveReplyTemplate(owner, 'Спасибо', 'Другой')).rejects.toThrow('уже есть');
  expect((await business.listReplyTemplates(company.id)).map(item => item.title)).toEqual(['Спасибо']);
  await business.deleteReplyTemplate(fan, saved.id).catch(() => undefined);
  expect(await business.listReplyTemplates(company.id)).toHaveLength(1);
  await business.deleteReplyTemplate(owner, saved.id);
  expect(await business.listReplyTemplates(company.id)).toEqual([]);
});

it('queues unanswered reviews, keeps team roles, the log and brand card edits', async () => {
  const edits = await import('../src/lib/brand-drink-edits');
  const { parseDrinkEdit } = await import('../src/lib/brand-drink-edit-fields');
  const company = (await business.getOwnBusiness(owner))!;
  // The reply queue: «Без ответа» and «Низкие оценки» agree with their counters.
  const queue = await business.countReviewQueue(company.id);
  const unanswered = await business.listBusinessReviews(company.id, { view: 'unanswered', limit: 100 });
  const low = await business.listBusinessReviews(company.id, { view: 'low', limit: 100 });
  expect(unanswered.total).toBe(queue.unanswered);
  expect(unanswered.items.every(item => !item.reply)).toBe(true);
  expect(low.total).toBe(queue.low);
  expect(low.items.every(item => item.taste + item.design < 10)).toBe(true);
  const reviewId = (await business.listBusinessReviews(company.id, { limit: 1 })).items[0]!.id;

  // An analyst looks only; the owner switches the role and it acts.
  // The fan's invitation from the team test above waits; the owner makes it an analyst's, and the fan accepts.
  await expect(business.inviteBusinessMember(owner, `@bz_${fan.slice(0, 12)}`, undefined, 'analyst')).rejects.toThrow('уже в команде или приглашён');
  await business.setBusinessMemberRole(owner, `user:${fan}`, 'analyst');
  await business.answerBusinessInvite(fan, company.id, true);
  expect(await business.getCabinet(fan)).toMatchObject({ role: 'analyst' });
  await expect(business.replyToReview(fan, reviewId, 'Спасибо!')).rejects.toThrow('Аналитик');
  await expect(business.saveReplyTemplate(fan, 'Шаблон', 'Текст')).rejects.toThrow('Аналитик');
  const form = new FormData(); form.set('fullName', '  Biz   Mango Zero '); form.set('description', 'Манго и лайм.');
  const input = parseDrinkEdit(form, false);
  expect(input).toEqual({ fullName: 'Biz Mango Zero', ingredients: null, description: 'Манго и лайм.', note: null });
  expect(() => parseDrinkEdit(new FormData(), false)).toThrow('хотя бы одно');
  await expect(edits.requestDrinkEdit(fan, brand, 'mango', input)).rejects.toThrow('Аналитик');
  await business.setBusinessMemberRole(owner, `user:${fan}`, 'manager');
  expect(await business.getCabinet(fan)).toMatchObject({ role: 'manager' });

  // A card edit of an approved drink only, one waiting at a time; staff decide; a later edit keeps untouched fields.
  await expect(edits.requestDrinkEdit(fan, brand, 'peach', input)).rejects.toThrow('подтверждённые');
  const first = await edits.requestDrinkEdit(fan, brand, 'mango', input, { data: Buffer.from('photo'), thumbnail: Buffer.from('thumb') });
  await expect(edits.requestDrinkEdit(owner, brand, 'mango', input)).rejects.toThrow('ждёт проверки');
  expect(await edits.getDrinkEditPhoto(first, owner, false, 'thumbnail')).toEqual(Buffer.from('thumb'));
  expect(await edits.getDrinkEditPhoto(first, staff, false, 'thumbnail')).toBeNull();
  await expect(edits.moderateDrinkEdit(fan, first, 'approved', '')).rejects.toThrow('команда');
  await edits.moderateDrinkEdit(staff, first, 'approved', '');
  expect(await edits.getBrandProfile(brand, 'mango')).toMatchObject({ business: 'Energy Lab', fullName: 'Biz Mango Zero', description: 'Манго и лайм.', ingredients: null, photo: expect.stringMatching(/^\/api\/brand-drink-photos\//u) });
  const composition = 'Вода питьевая, сахар, регулятор кислотности лимонная кислота, таурин, кофеин.';
  const second = await edits.requestDrinkEdit(owner, brand, 'mango', { fullName: null, ingredients: composition, description: null, note: 'новый состав' });
  await expect(edits.moderateDrinkEdit(staff, second, 'rejected', ' ')).rejects.toThrow('причину');
  await edits.moderateDrinkEdit(staff, second, 'approved', '');
  const profile = (await edits.getBrandProfile(brand, 'mango'))!;
  expect(profile).toMatchObject({ fullName: 'Biz Mango Zero', description: 'Манго и лайм.', ingredients: composition });
  expect(edits.brandIngredients(profile, brand, 'mango', 450)).toMatchObject({ status: 'source_reported', sourceName: 'Бренд «Energy Lab»', ingredients: composition });
  expect((await edits.listDrinkEdits(company.id)).map(edit => edit.status)).toEqual(['approved', 'approved']);

  // The team's log and the first steps.
  const log = (await business.listBusinessAudit(company.id)).map(entry => entry.action);
  expect(log).toEqual(expect.arrayContaining(['invite', 'member-role', 'drink-edit', 'competitor']));
  const steps = await business.getOnboarding(company);
  expect(steps.find(step => step.key === 'team')?.done).toBe(true);
  expect(steps.find(step => step.key === 'verified')?.done).toBe(true);
  await business.leaveBusiness(fan);
});

it('keeps plans: the free start, invoices that extend a plan and promotion requests', async () => {
  const billing = await import('../src/lib/business-billing');
  const plans = await import('../src/lib/business-plans');
  const competitors = await import('../src/lib/business-competitors');
  const company = (await business.getOwnBusiness(owner))!;
  // On «Старт» (the paid plan ran out) competitors are closed and the team is capped.
  await pool.query(`update business set plan = 'brand', "planUntil" = now() - interval '1 day' where id = $1`, [company.id]);
  const expired = (await business.getOwnBusiness(owner))!;
  expect(plans.effectivePlan(expired)).toBe('start');
  expect(plans.hasFeature(expired, 'search')).toBe(false);
  await expect(competitors.addCompetitor(company.id, `${brand} Rival`)).rejects.toThrow('тарифах «Бренд» и «Сеть»');

  // The owner asks for an invoice (one open at a time); the admin marks it paid and the plan runs a month from today.
  const form = new FormData();
  for (const [key, value] of Object.entries({ plan: 'brand', period: 'month', payer: 'ООО «Энерджи Лаб»', inn: '7700000000', email: 'pay@example.com' })) form.set(key, value);
  await expect(billing.requestPlan(fan, plans.parsePlanRequest(form))).rejects.toThrow('владелец');
  await billing.requestPlan(owner, plans.parsePlanRequest(form));
  await expect(billing.requestPlan(owner, plans.parsePlanRequest(form))).rejects.toThrow('уже есть');
  const [request] = await billing.listPlanRequests(company.id);
  expect(request).toMatchObject({ plan: 'brand', period: 'month', status: 'pending', amount: company.founder ? plans.FOUNDER_MONTHLY : 4900 });
  await expect(billing.setPlanRequestStatus(staff, request!.id, 'paid', '')).rejects.toThrow('администратор');
  await billing.setPlanRequestStatus(admin, request!.id, 'paid', 'Счёт №1');
  const paid = (await business.getOwnBusiness(owner))!;
  expect(plans.effectivePlan(paid)).toBe('brand');
  expect(Math.round((new Date(paid.planUntil!).getTime() - Date.now()) / 86_400_000)).toBeGreaterThanOrEqual(27);
  await expect(billing.setPlanRequestStatus(admin, request!.id, 'cancelled', '')).rejects.toThrow('закрыта');

  // Promotion: a request, and «Запущено» only with the ОРД token.
  const promo = new FormData(); promo.set('placement', 'picks'); promo.set('budget', '30 000'); promo.set('comment', 'Новинка');
  await billing.requestPromo(owner, plans.parsePromoRequest(promo));
  const [created] = await billing.listPromoRequests(company.id);
  expect(created).toMatchObject({ placement: 'picks', budget: 30000, status: 'new' });
  await expect(billing.setPromoStatus(admin, created!.id, 'running', '')).rejects.toThrow('erid');
  await billing.setPromoStatus(admin, created!.id, 'running', 'Kra23abc');
  expect((await billing.listPromoRequests(company.id))[0]).toMatchObject({ status: 'running', erid: 'Kra23abc' });
  await pool.query(`delete from "businessPromoRequest" where "businessId" = $1`, [company.id]);
  await pool.query(`delete from "businessPlanRequest" where "businessId" = $1`, [company.id]);
});

it('lists where to buy a drink: chains and own stores of approved drinks only', async () => {
  const stores = await import('../src/lib/brand-drink-stores');
  const { parseDrinkStore, MAX_DRINK_STORES } = await import('../src/lib/brand-drink-store-fields');
  const company = (await business.getOwnBusiness(owner))!;
  const form = (fields: Record<string, string>) => { const data = new FormData(); for (const [key, value] of Object.entries(fields)) data.set(key, value); return parseDrinkStore(data); };
  expect(form({ kind: 'custom', name: ' Фирменный  магазин ', url: 'shop.example.ru/energy' })).toEqual({ kind: 'custom', name: 'Фирменный магазин', url: 'https://shop.example.ru/energy', address: null, city: null });
  expect(() => form({ kind: 'custom', name: 'Без адреса' })).toThrow('ссылку');
  expect(() => form({ kind: 'custom', name: 'Скрипт', url: 'javascript:alert(1)' })).toThrow('http');
  expect(() => form({ kind: 'store', storeId: 'nope' })).toThrow('из списка');

  // Only for the company's approved drinks, and a store must be on the CanRush map.
  await expect(stores.addDrinkStore(owner, brand, 'peach', form({ kind: 'retailer', retailer: 'Пятёрочка' }))).rejects.toThrow('подтверждённых');
  await expect(stores.addDrinkStore(owner, brand, 'mango', form({ kind: 'store', storeId: randomUUID() }))).rejects.toThrow('не найден');
  await stores.addDrinkStore(owner, brand, 'mango', form({ kind: 'retailer', retailer: 'Пятёрочка' }));
  await expect(stores.addDrinkStore(owner, brand, 'mango', form({ kind: 'retailer', retailer: 'пятёрочка' }))).rejects.toThrow('уже в списке');
  await stores.addDrinkStore(owner, brand, 'mango', form({ kind: 'custom', name: 'Фирменный магазин', address: 'ул. Тверская, 1', city: 'Москва' }));
  const list = await stores.listDrinkStores(company.id, brand, 'mango');
  expect(list.map(item => [item.kind, item.name])).toEqual([['retailer', 'Пятёрочка'], ['custom', 'Фирменный магазин']]);
  expect((await stores.countDrinkStores(company.id)).get(JSON.stringify([brand, 'mango']))).toBe(2);

  // The drink page shows them while the company and the drink stay approved.
  expect((await stores.getBrandStores(brand, 'mango')).map(item => item.name)).toEqual(['Пятёрочка', 'Фирменный магазин']);
  await pool.query(`update "businessDrink" set status = 'pending' where "businessId" = $1 and brand = $2 and flavor = 'mango'`, [company.id, brand]);
  expect(await stores.getBrandStores(brand, 'mango')).toEqual([]);
  await pool.query(`update "businessDrink" set status = 'approved' where "businessId" = $1 and brand = $2 and flavor = 'mango'`, [company.id, brand]);

  // A cap per drink; someone outside the company can neither add nor remove.
  for (let index = list.length; index < MAX_DRINK_STORES; index += 1) await stores.addDrinkStore(owner, brand, 'mango', form({ kind: 'retailer', retailer: `Сеть ${index}` }));
  await expect(stores.addDrinkStore(owner, brand, 'mango', form({ kind: 'retailer', retailer: 'Лишняя' }))).rejects.toThrow(`Не больше ${MAX_DRINK_STORES}`);
  await expect(stores.addDrinkStore(staff, brand, 'mango', form({ kind: 'retailer', retailer: 'Ещё' }))).rejects.toThrow('подтверждённая компания');
  await expect(stores.removeDrinkStore(staff, list[0]!.id)).rejects.toThrow();
  await stores.removeDrinkStore(owner, list[0]!.id);
  expect((await stores.listDrinkStores(company.id, brand, 'mango')).some(item => item.id === list[0]!.id)).toBe(false);
  await pool.query(`delete from "brandDrinkStore" where "businessId" = $1`, [company.id]);
});

it('keeps a recommended price ceiling per can volume of approved drinks', async () => {
  const prices = await import('../src/lib/brand-drink-prices');
  const { parseDrinkPrice } = await import('../src/lib/brand-drink-price-fields');
  const company = (await business.getOwnBusiness(owner))!;
  const form = (volume: string, price: string) => { const data = new FormData(); data.set('volume', volume); data.set('price', price); return parseDrinkPrice(data); };
  expect(form(' 450 ', '119,9')).toEqual({ volumeMl: 450, maxPrice: 119.9 });
  expect(() => form('50', '100')).toThrow('от 100 до 2000');
  expect(() => form('450', '1,999')).toThrow('двух знаков');
  expect(() => form('450', '0')).toThrow('больше нуля');

  await expect(prices.setDrinkPrice(owner, brand, 'peach', form('450', '99'))).rejects.toThrow('подтверждённых');
  await prices.setDrinkPrice(owner, brand, 'mango', form('450', '129.90'));
  await prices.setDrinkPrice(owner, brand, 'mango', form('450', '119.90'));
  await prices.setDrinkPrice(owner, brand, 'mango', form('250', '89'));
  const list = await prices.listDrinkPrices(company.id, brand, 'mango');
  expect(list.map(item => [item.volumeMl, item.maxPrice])).toEqual([[250, 89], [450, 119.9]]);
  expect((await prices.countDrinkPrices(company.id)).get(JSON.stringify([brand, 'mango']))).toBe(2);
  expect((await prices.getBrandPrices(brand, 'mango')).map(item => item.maxPrice)).toEqual([89, 119.9]);

  // Gone from the drink page while the drink is not approved for the company; outsiders cannot change it.
  await pool.query(`update "businessDrink" set status = 'pending' where "businessId" = $1 and brand = $2 and flavor = 'mango'`, [company.id, brand]);
  expect(await prices.getBrandPrices(brand, 'mango')).toEqual([]);
  await pool.query(`update "businessDrink" set status = 'approved' where "businessId" = $1 and brand = $2 and flavor = 'mango'`, [company.id, brand]);
  await expect(prices.setDrinkPrice(staff, brand, 'mango', form('450', '10'))).rejects.toThrow('подтверждённая компания');
  await expect(prices.removeDrinkPrice(staff, list[0]!.id)).rejects.toThrow();
  await prices.removeDrinkPrice(owner, list[0]!.id);
  expect((await prices.listDrinkPrices(company.id, brand, 'mango')).map(item => item.volumeMl)).toEqual([450]);
  await pool.query(`delete from "brandDrinkPrice" where "businessId" = $1`, [company.id]);
});
