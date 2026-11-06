import type { PoolClient } from 'pg';
import { getPool } from '@/db/pool';
import { getCatalogGroup } from '@/lib/catalog';
import { DrinkQuestionError, QUESTION_PAUSE_SECONDS, QUESTIONS_SHOWN, parseAnswerText, parseQuestionText } from '@/lib/drink-question-fields';
import { notBlockedBy } from '@/lib/member-blocks';
import { AUTHOR_COLUMNS } from '@/lib/profile-community';
import { isContentId } from '@/lib/profile-report-fields';

export interface QuestionAuthor { username: string; name: string; avatarId: string | null; xp: number; tag: string | null; verified: boolean }
/**
 * `company` — when the answer comes from the owner or an active member of an approved company of this drink: the page's
 * company or any other with the drink approved (each sees the question in its cabinet's «Вопросы»).
 */
export interface DrinkAnswer extends QuestionAuthor { id: string; questionId: string; userId: string; text: string; createdAt: Date; company: string | null }
export interface DrinkQuestion extends QuestionAuthor { id: string; userId: string; text: string; createdAt: Date; answers: DrinkAnswer[] }

// Authors as the feed shows them: with a nickname, not blocked by the site, not blocked by the viewer ($viewer).
const VISIBLE_AUTHOR = (viewer: string, author: string) => `u.username is not null and not exists(select 1 from "userBlock" b where b."userId" = u.id) and ${notBlockedBy(viewer, author)}`;

/**
 * The drink's newest questions with all their answers (oldest first), the total, and whether the viewer may delete as
 * staff. `companyId` is the drink's company (the page knows it): answers of its team carry its name.
 */
export async function getDrinkQuestions(brand: string, flavor: string, viewerId: string | null, companyId: string | null) {
  const [questions, staff] = await Promise.all([
    getPool().query<Omit<DrinkQuestion, 'answers'> & { total: number }>(`select q.id, q."userId", q.text, q."createdAt", ${AUTHOR_COLUMNS}, count(*) over()::int as total
      from "drinkQuestion" q join "user" u on u.id = q."userId"
      where q.brand = $1 and q.flavor = $2 and ${VISIBLE_AUTHOR('$3::text', 'q."userId"')}
      order by q."createdAt" desc, q.id desc limit $4`, [brand, flavor, viewerId, QUESTIONS_SHOWN]),
    viewerId ? getPool().query<{ staff: boolean }>('select exists(select 1 from "user" su join "siteAdmin" sa on lower(su.email) = sa.email where su.id = $1) as staff', [viewerId]) : null,
  ]);
  const ids = questions.rows.map(question => question.id);
  const answers = ids.length ? (await getPool().query<DrinkAnswer>(`select a.id, a."questionId", a."userId", a.text, a."createdAt", ${AUTHOR_COLUMNS},
      (select b.name from business b where b.status = 'approved'
        and (b.id = $3::uuid or exists(select 1 from "businessDrink" d where d."businessId" = b.id and d.status = 'approved' and d.brand = $4 and d.flavor = $5))
        and (b."ownerId" = a."userId" or exists(select 1 from "businessMember" m where m."businessId" = b.id and m."userId" = a."userId" and m.status = 'active'))
        order by b.id = $3::uuid desc, b."createdAt" limit 1) as company
    from "drinkAnswer" a join "user" u on u.id = a."userId"
    where a."questionId" = any($1::uuid[]) and ${VISIBLE_AUTHOR('$2::text', 'a."userId"')}
    order by a."createdAt", a.id`, [ids, viewerId, companyId, brand, flavor])).rows : [];
  return {
    questions: questions.rows.map(({ total: _total, ...question }) => ({ ...question, answers: answers.filter(answer => answer.questionId === question.id) })),
    total: questions.rows[0]?.total ?? 0,
    staff: staff?.rows[0]?.staff === true,
  };
}

/**
 * Locks the member for one post: a site block and a missing nickname stop it (the feed shows questions only from members
 * with a nickname), and so does a question or answer in the last few seconds. A freeze is the tables' trigger (CR002).
 */
async function lockPoster(client: PoolClient, userId: string) {
  const { rows: [member] } = await client.query<{ username: string | null; blocked: boolean; recent: boolean }>(`select u.username,
      exists(select 1 from "userBlock" where "userId" = u.id) as blocked,
      coalesce(greatest((select max("createdAt") from "drinkQuestion" where "userId" = u.id), (select max("createdAt") from "drinkAnswer" where "userId" = u.id))
        > now() - interval '${QUESTION_PAUSE_SECONDS} seconds', false) as recent
    from "user" u where u.id = $1 for no key update of u`, [userId]);
  if (!member || member.blocked) throw new DrinkQuestionError('Аккаунт заблокирован: писать нельзя.');
  if (!member.username) throw new DrinkQuestionError('Придумайте ник в настройках профиля, чтобы задавать вопросы и отвечать.');
  if (member.recent) throw new DrinkQuestionError(`Следующий вопрос или ответ можно отправить через ${QUESTION_PAUSE_SECONDS} секунд.`);
}

async function inTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('begin');
    const result = await work(client);
    await client.query('commit');
    return result;
  } catch (error) { await client.query('rollback'); throw error; }
  finally { client.release(); }
}

/** A question about a catalog drink, under the catalog's own spelling of it. */
export async function askDrinkQuestion(userId: string, brand: string, flavor: string, input: unknown) {
  const text = parseQuestionText(input);
  const group = await getCatalogGroup(brand, flavor);
  if (!group) throw new DrinkQuestionError('Такого напитка нет в каталоге.');
  return inTransaction(async client => {
    await lockPoster(client, userId);
    const { rows: [row] } = await client.query<{ id: string }>('insert into "drinkQuestion" ("userId", brand, flavor, text) values ($1, $2, $3, $4) returning id', [userId, group.brand, group.flavor, text]);
    return { id: row!.id, brand: group.brand, flavor: group.flavor };
  });
}

/** An answer; the question's author hears about it from the table's trigger. */
export async function answerDrinkQuestion(userId: string, questionId: string, input: unknown) {
  const text = parseAnswerText(input);
  if (!isContentId(questionId)) throw new DrinkQuestionError('Вопрос не найден.');
  return inTransaction(async client => {
    await lockPoster(client, userId);
    const { rows: [question] } = await client.query<{ brand: string; flavor: string }>('select brand, flavor from "drinkQuestion" where id = $1', [questionId]);
    if (!question) throw new DrinkQuestionError('Вопрос уже удалён.');
    const { rows: [row] } = await client.query<{ id: string }>('insert into "drinkAnswer" ("questionId", "userId", text) values ($1, $2, $3) returning id', [questionId, userId, text]);
    return { id: row!.id, ...question };
  });
}

/** The author deletes their own question (its answers go with it) or answer; the drink comes back for revalidation. */
export async function deleteDrinkQuestion(userId: string, id: string) {
  if (!isContentId(id)) return null;
  return (await getPool().query<{ brand: string; flavor: string }>('delete from "drinkQuestion" where id = $1 and "userId" = $2 returning brand, flavor', [id, userId])).rows[0] ?? null;
}

export async function deleteDrinkAnswer(userId: string, id: string) {
  if (!isContentId(id)) return null;
  return (await getPool().query<{ brand: string; flavor: string }>(`delete from "drinkAnswer" a using "drinkQuestion" q
    where a.id = $1 and a."userId" = $2 and q.id = a."questionId" returning q.brand, q.flavor`, [id, userId])).rows[0] ?? null;
}
