import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Test DB only');
const pool = new Pool({ connectionString: url, max: 4 });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
// Any drink exists here, without covers.
vi.mock('@/lib/catalog', () => ({ getCatalogGroup: async (brand: string, flavor: string) => ({ brand, flavor }), loadAllCatalogGroups: async () => [] }));
const { askDrinkQuestion, answerDrinkQuestion, getDrinkQuestions } = await import('../src/lib/drink-questions');
const { answerBusinessQuestion, countUnansweredQuestions, listBusinessQuestions } = await import('../src/lib/business-questions');
const { getNotificationById } = await import('../src/lib/notifications');

const [owner, manager, analyst, asker, curious, outsider, banned] = Array.from({ length: 7 }, () => randomUUID()) as [string, string, string, string, string, string, string];
const everyone = [owner, manager, analyst, asker, curious, outsider, banned];
const brand = `Вопрос бренду ${randomUUID().slice(0, 8)}`;
let companyId = '';
// One post per member every 15 seconds: tests step back in time instead of waiting.
async function age() {
  await pool.query(`update "drinkQuestion" set "createdAt" = "createdAt" - interval '1 minute' where "userId" = any($1::text[])`, [everyone]);
  await pool.query(`update "drinkAnswer" set "createdAt" = "createdAt" - interval '1 minute' where "userId" = any($1::text[])`, [everyone]);
}
const notified = async (questionId: string) => (await pool.query<{ userId: string }>(
  `select "userId" from notification where kind = 'business-question' and payload->>'questionId' = $1 order by "userId"`, [questionId])).rows.map(row => row.userId);

beforeAll(async () => {
  for (const id of everyone) await pool.query(`insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt",username) values($1,'Компания',$2,true,now(),now(),$3)`,
    [id, `${id}@example.com`, `bq_${id.slice(0, 12)}`]);
  companyId = (await pool.query<{ id: string }>(`insert into business ("ownerId", name, kind, status) values ($1, 'Вопросы Лаб', 'brand', 'approved') returning id`, [owner])).rows[0]!.id;
  await pool.query(`insert into "businessMember"("businessId","userId",status,role) values ($1,$2,'active','manager'),($1,$3,'active','analyst')`, [companyId, manager, analyst]);
  await pool.query(`insert into "businessDrink"("businessId",brand,flavor,status) values ($1,$2,'mango','approved'),($1,$2,'cherry','pending')`, [companyId, brand]);
  await pool.query('insert into "userBlock" ("userId") values ($1)', [banned]);
});

afterAll(async () => {
  await pool.query('delete from business where id = $1', [companyId]);
  await pool.query('delete from "drinkQuestion" where brand = $1', [brand]);
  await pool.query('delete from "user" where id = any($1::text[])', [everyone]);
  await pool.end();
});

it('tells the owner and the active team about a question to an approved drink, as long as they want it', async () => {
  const first = await askDrinkQuestion(asker, brand, 'mango', 'Есть ли версия без сахара?');
  expect(await notified(first.id)).toEqual([owner, manager, analyst].sort());
  const notice = (await pool.query<{ id: string }>(`select id from notification where kind = 'business-question' and "userId" = $1 and payload->>'questionId' = $2`, [owner, first.id])).rows[0]!;
  expect(await getNotificationById(notice.id)).toMatchObject({ title: `Новый вопрос: ${brand} · Манго`, href: '/business/cabinet?section=questions' });

  // Not about a drink the team waits for approval of, and not to the one who asks.
  await age();
  const pending = await askDrinkQuestion(curious, brand, 'cherry', 'А вишнёвый где купить?');
  expect(await notified(pending.id)).toEqual([]);
  await age();
  const own = await askDrinkQuestion(manager, brand, 'mango', 'Какой вкус выпустить следующим?');
  expect(await notified(own.id)).toEqual([owner, analyst].sort());

  // The cabinet switch is the shared preference table.
  await pool.query(`insert into "notificationPreference"("userId", kind, enabled) values ($1, 'business-question', false)`, [analyst]);
  await age();
  const later = await askDrinkQuestion(curious, brand, 'mango', 'Сколько кофеина в банке?');
  expect(await notified(later.id)).toEqual([owner, manager].sort());
});

it('lists the questions to approved drinks, the unanswered ones apart, and lets the owner and managers answer', async () => {
  const before = await countUnansweredQuestions(companyId, owner);
  expect(before).toEqual({ unanswered: 3, all: 3 });
  const { items, total } = await listBusinessQuestions(companyId, owner);
  expect(total).toBe(3);
  expect(items.every(item => item.brand === brand && item.flavor === 'mango' && !item.answered)).toBe(true);
  const question = items.find(item => item.text === 'Есть ли версия без сахара?')!;

  // Someone else's answer doesn't settle a question to the brand.
  await age();
  await answerDrinkQuestion(outsider, question.id, 'Видел в «Пятёрочке».');
  expect((await countUnansweredQuestions(companyId, owner)).unanswered).toBe(3);

  await expect(answerBusinessQuestion(analyst, question.id, 'Скоро будет.')).rejects.toThrow('Аналитик');
  await expect(answerBusinessQuestion(outsider, question.id, 'Скоро будет.')).rejects.toThrow('подтверждённая компания');
  const cherry = (await pool.query<{ id: string }>(`select id from "drinkQuestion" where brand = $1 and flavor = 'cherry'`, [brand])).rows[0]!.id;
  await expect(answerBusinessQuestion(owner, cherry, 'Скоро будет.')).rejects.toThrow('подтверждённом напитке');

  await age();
  expect(await answerBusinessQuestion(manager, question.id, 'Да, с зелёной полосой на банке.')).toMatchObject({ brand, flavor: 'mango' });
  expect(await countUnansweredQuestions(companyId, owner)).toEqual({ unanswered: 2, all: 3 });
  const answered = (await listBusinessQuestions(companyId, owner, { view: 'all' })).items.find(item => item.id === question.id)!;
  expect(answered.answered).toBe(true);
  expect(answered.answers.map(answer => [answer.text, answer.company])).toEqual([['Видел в «Пятёрочке».', false], ['Да, с зелёной полосой на банке.', true]]);
  expect((await listBusinessQuestions(companyId, owner)).items.map(item => item.id)).not.toContain(question.id);
  expect((await pool.query(`select 1 from "businessAuditLog" where "businessId" = $1 and action = 'question-answer'`, [companyId])).rowCount).toBe(1);
  // The drink page marks it with the company's name even when the page's own company is another (or none).
  const onPage = (await getDrinkQuestions(brand, 'mango', asker, null)).questions.find(item => item.id === question.id)!;
  expect(onPage.answers.map(answer => answer.company)).toEqual([null, 'Вопросы Лаб']);
  // The asker hears about the company's answer like about any other.
  expect((await pool.query(`select 1 from notification where kind = 'question-answer' and "userId" = $1 and "actorId" = $2`, [asker, manager])).rowCount).toBe(1);
});

it('leaves out a question from a member the site blocked, and tells no one about it', async () => {
  await age();
  // Asked before the block: the block hides it afterwards.
  const hidden = await askDrinkQuestion(curious, brand, 'mango', 'А в жестяной банке 0,33 бывает?');
  await pool.query('update "drinkQuestion" set "userId" = $1 where id = $2', [banned, hidden.id]);
  expect((await listBusinessQuestions(companyId, owner, { view: 'all' })).items.map(item => item.id)).not.toContain(hidden.id);
  await pool.query(`insert into "drinkQuestion" ("userId", brand, flavor, text) values ($1, $2, 'mango', 'Вопрос от заблокированного')`, [banned, brand]);
  expect((await pool.query(`select 1 from notification where kind = 'business-question' and "actorId" = $1`, [banned])).rowCount).toBe(0);
});
