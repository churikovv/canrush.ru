import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Test DB only');
const pool = new Pool({ connectionString: url, max: 4 });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
// Any drink exists here; the catalog's own spelling is the one given.
vi.mock('@/lib/catalog', () => ({ getCatalogGroup: async (brand: string, flavor: string) => (brand.startsWith('Нет') ? null : { brand, flavor }) }));
const { answerDrinkQuestion, askDrinkQuestion, deleteDrinkAnswer, deleteDrinkQuestion, getDrinkQuestions } = await import('../src/lib/drink-questions');
const { addCollectionPhotos, deleteCollectionPhoto, getCollectionPhotoFile, listCollectionPhotos } = await import('../src/lib/collection-photos');
const { MAX_COLLECTION_PHOTOS } = await import('../src/lib/collection-photo-fields');
const { getFeed } = await import('../src/lib/profile-community');
const { createContentReport } = await import('../src/lib/profile-reports');
const { staffDeleteContent } = await import('../src/lib/staff-moderation');
const { isMemberBlockedError } = await import('../src/lib/member-blocks');
const { isFrozenError } = await import('../src/lib/moderation');

const [asker, expert, owner, blocker, banned, nameless, moderator] = Array.from({ length: 7 }, () => randomUUID()) as [string, string, string, string, string, string, string];
const everyone = [asker, expert, owner, blocker, banned, nameless, moderator];
const brand = `Вопрос ${randomUUID().slice(0, 8)}`;
const moderatorEmail = `${moderator}@example.com`;
let companyId = '';
// One post per member every 15 seconds: tests step back in time instead of waiting.
async function age(userId: string) {
  await pool.query(`update "drinkQuestion" set "createdAt" = "createdAt" - interval '1 minute' where "userId" = $1`, [userId]);
  await pool.query(`update "drinkAnswer" set "createdAt" = "createdAt" - interval '1 minute' where "userId" = $1`, [userId]);
}
const photo = { data: Buffer.from('полка'), thumbnail: Buffer.from('миниатюра') };

beforeAll(async () => {
  for (const id of everyone) await pool.query(`insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt",username) values($1,'Вопросы',$2,true,now(),now(),$3)`,
    [id, `${id}@example.com`, id === nameless ? null : `qa_${id.slice(0, 12)}`]);
  await pool.query('insert into "userBlock" ("userId") values ($1)', [banned]);
  await pool.query('insert into "memberBlock"("blockerId","blockedId") values($1,$2)', [blocker, expert]);
  await pool.query('insert into "siteAdmin"(email, role) values($1, \'moderator\')', [moderatorEmail]);
  companyId = (await pool.query<{ id: string }>(`insert into business ("ownerId", name, kind, status) values ($1, 'Энерджи Лаб', 'brand', 'approved') returning id`, [owner])).rows[0]!.id;
});

afterAll(async () => {
  await pool.query('delete from "siteAdmin" where email = $1', [moderatorEmail]);
  await pool.query('delete from "adminAuditLog" where "adminEmail" = $1', [moderatorEmail]);
  await pool.query('delete from business where id = $1', [companyId]);
  await pool.query('delete from "drinkQuestion" where brand like $1', [`${brand}%`]);
  await pool.query('delete from "user" where id = any($1::text[])', [everyone]);
  await pool.end();
});

it('asks under the catalog spelling, once in a while, and only with a nickname', async () => {
  const asked = await askDrinkQuestion(asker, brand, 'mango', '  Бывает ли в банке   0,25? ');
  expect(asked).toMatchObject({ brand, flavor: 'mango' });
  expect((await pool.query('select text from "drinkQuestion" where id = $1', [asked.id])).rows).toEqual([{ text: 'Бывает ли в банке 0,25?' }]);
  await expect(askDrinkQuestion(asker, brand, 'mango', 'А в 0,5 бывает?')).rejects.toThrow('через 15 секунд');
  await expect(askDrinkQuestion(banned, brand, 'mango', 'Сколько кофеина?')).rejects.toThrow('заблокирован');
  await expect(askDrinkQuestion(nameless, brand, 'mango', 'Сколько кофеина?')).rejects.toThrow('ник');
  await expect(askDrinkQuestion(expert, `Нет ${brand}`, 'mango', 'Сколько кофеина?')).rejects.toThrow('нет в каталоге');
  await expect(askDrinkQuestion(expert, brand, 'mango', 'Где')).rejects.toThrow('от 5');
});

it('tells the asker about each answerer once, marks the company and hides what the viewer blocked', async () => {
  await age(asker);
  const { id } = await askDrinkQuestion(asker, brand, 'cola', 'Сильно сладкий?');
  await answerDrinkQuestion(expert, id, 'Средне, как кола');
  await age(expert);
  await answerDrinkQuestion(expert, id, 'И пузырьков много');
  await answerDrinkQuestion(owner, id, 'Сахара 11 г на 100 мл');
  await age(asker);
  await answerDrinkQuestion(asker, id, 'Спасибо!');
  const notes = await pool.query<{ actorId: string; payload: { questionId: string; brand: string } }>(`select "actorId", payload from notification where "userId" = $1 and kind = 'question-answer' order by "createdAt"`, [asker]);
  expect(notes.rows.map(row => row.actorId)).toEqual([expert, owner]);
  expect(notes.rows[0]!.payload).toMatchObject({ questionId: id, brand });

  const page = await getDrinkQuestions(brand, 'cola', null, companyId);
  expect(page.total).toBe(1);
  expect(page.questions[0]!.answers.map(answer => [answer.text, answer.company])).toEqual([
    ['Средне, как кола', null], ['И пузырьков много', null], ['Сахара 11 г на 100 мл', 'Энерджи Лаб'], ['Спасибо!', null],
  ]);
  expect((await getDrinkQuestions(brand, 'cola', blocker, companyId)).questions[0]!.answers.map(answer => answer.userId)).not.toContain(expert);
  expect(page.staff).toBe(false);
  expect((await getDrinkQuestions(brand, 'cola', moderator, null)).staff).toBe(true);
});

it('stops answers between members who blocked each other, and frozen members', async () => {
  const { id } = await askDrinkQuestion(blocker, brand, 'lime', 'Какой на вкус лайм?');
  await age(expert);
  const blocked = await answerDrinkQuestion(expert, id, 'Кислый').then(() => null, (error: unknown) => error);
  expect(isMemberBlockedError(blocked)).toBe(true);
  await pool.query(`insert into "userFreeze"("userId", until) values($1, now() + interval '1 day')`, [moderator]);
  const frozen = await askDrinkQuestion(moderator, brand, 'lime', 'А без сахара бывает?').then(() => null, (error: unknown) => error);
  expect(isFrozenError(frozen)).toBe(true);
  await pool.query('delete from "userFreeze" where "userId" = $1', [moderator]);
});

it('shows a question in the feed, takes reports and deletes for the author or staff only', async () => {
  await age(expert);
  const { id } = await askDrinkQuestion(expert, brand, 'tea', 'Чай чувствуется?');
  const feed = await getFeed(null, 'all', 1);
  expect(feed.items.some(item => item.kind === 'question' && item.question.id === id && item.question.answers === 0)).toBe(true);
  expect((await getFeed(blocker, 'all', 1)).items.some(item => item.kind === 'question' && item.question.id === id)).toBe(false);

  await age(owner);
  const answer = await answerDrinkQuestion(owner, id, 'Да, зелёный');
  expect(await createContentReport(asker, 'drink-question', id, 'spam', '')).toBe('sent');
  expect(await createContentReport(asker, 'drink-answer', answer.id, 'spam', '')).toBe('sent');
  expect(await deleteDrinkAnswer(asker, answer.id)).toBeNull();
  expect(await staffDeleteContent(asker, 'drink-answer', answer.id)).toBe(false);
  expect(await staffDeleteContent(moderator, 'drink-answer', answer.id)).toBe(true);
  expect(await deleteDrinkQuestion(asker, id)).toBeNull();
  expect(await deleteDrinkQuestion(expert, id)).toEqual({ brand, flavor: 'tea' });
});

it('moves questions with a merged drink', async () => {
  await age(asker);
  const { id } = await askDrinkQuestion(asker, brand, 'old', 'Старый дизайн ещё продают?');
  await pool.query('select move_drink_identity($1, $2, $3, $4)', [brand, 'old', `${brand} new`, 'old']);
  expect((await pool.query('select brand from "drinkQuestion" where id = $1', [id])).rows).toEqual([{ brand: `${brand} new` }]);
});

it('keeps up to twelve collection photos, serves them while the owner is not blocked and lets the owner delete', async () => {
  await addCollectionPhotos(asker, [{ photo, caption: 'Лимитки' }, { photo, caption: null }]);
  const { photos, staff } = await listCollectionPhotos(asker, expert);
  expect(photos.map(item => item.caption).sort()).toEqual(['Лимитки', null].sort());
  expect(staff).toBe(false);
  await expect(addCollectionPhotos(asker, Array.from({ length: MAX_COLLECTION_PHOTOS - 1 }, () => ({ photo, caption: null })))).rejects.toThrow('ещё 10');
  await expect(addCollectionPhotos(banned, [{ photo, caption: null }])).rejects.toThrow('заблокирован');
  const first = photos[0]!.id;
  expect((await getCollectionPhotoFile(first, true))?.toString()).toBe('миниатюра');
  expect((await getCollectionPhotoFile(first, false))?.toString()).toBe('полка');
  expect(await createContentReport(expert, 'collection-photo', first, 'spam', '')).toBe('sent');
  expect(await deleteCollectionPhoto(expert, first)).toBe(false);
  expect(await deleteCollectionPhoto(asker, first)).toBe(true);
  expect(await staffDeleteContent(moderator, 'collection-photo', photos[1]!.id)).toBe(true);
  expect((await listCollectionPhotos(asker, null)).photos).toEqual([]);
});
