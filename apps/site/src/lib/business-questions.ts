import { getPool } from '@/db/pool';
import { getCabinet, logBusiness } from '@/lib/business';
import { BusinessError } from '@/lib/business-fields';
import { loadAllCatalogGroups } from '@/lib/catalog';
import { catalogGroupSlug, flavorName } from '@/lib/catalog-query';
import { answerDrinkQuestion } from '@/lib/drink-questions';
import { notBlockedBy } from '@/lib/member-blocks';
import { frozenMessage } from '@/lib/moderation';
import { isContentId } from '@/lib/profile-report-fields';

/**
 * «Вопросы» in the business cabinet: what members ask about the company's approved drinks on the drink pages
 * (`drinkQuestion`), with every answer, and the company's own answer from here. «Без ответа» means no answer from the
 * company's team yet — someone else's answer doesn't settle a question to the brand. Authors as the drink page shows
 * them: with a nickname, not blocked by the site, not blocked by the viewer.
 */
export type BusinessQuestionView = 'unanswered' | 'all';
export interface BusinessQuestionAnswer { id: string; text: string; createdAt: Date; username: string; name: string; company: boolean }
export interface BusinessQuestion {
  id: string; brand: string; flavor: string; name: string; slug: string; cover: string | null;
  text: string; createdAt: Date; username: string; authorName: string;
  answered: boolean; answers: BusinessQuestionAnswer[];
}

/** The company's questions: `$1` the company, `$2` the viewer. Team — the owner and the active members. */
const QUESTIONS = `with team as (
    select b."ownerId" as "userId" from business b where b.id = $1
    union select m."userId" from "businessMember" m where m."businessId" = $1 and m.status = 'active'
  )
  select q.id, q.brand, q.flavor, q.text, q."createdAt", u.username, u.name as "authorName",
    exists(select 1 from "drinkAnswer" a where a."questionId" = q.id and a."userId" in (select "userId" from team)) as answered
  from "drinkQuestion" q join "user" u on u.id = q."userId"
  where exists(select 1 from "businessDrink" d where d."businessId" = $1 and d.status = 'approved' and d.brand = q.brand and d.flavor = q.flavor)
    and u.username is not null and not exists(select 1 from "userBlock" ub where ub."userId" = u.id)
    and ${notBlockedBy('$2::text', 'q."userId"')}`;

export async function listBusinessQuestions(businessId: string, viewerId: string, { view = 'unanswered', page = 1, size = 20 }: { view?: BusinessQuestionView; page?: number; size?: number } = {}): Promise<{ items: BusinessQuestion[]; total: number }> {
  const { rows } = await getPool().query<Omit<BusinessQuestion, 'name' | 'slug' | 'cover' | 'answers'> & { total: number }>(
    `select *, count(*) over()::int as total from (${QUESTIONS}) q where $3 = 'all' or not q.answered
     order by q."createdAt" desc, q.id desc limit $4 offset $5`, [businessId, viewerId, view, size, (page - 1) * size]);
  if (!rows.length) return { items: [], total: 0 };
  const [answers, groups] = await Promise.all([getPool().query<BusinessQuestionAnswer & { questionId: string }>(
    `select a.id, a."questionId", a.text, a."createdAt", u.username, u.name,
       (a."userId" = b."ownerId" or exists(select 1 from "businessMember" m where m."businessId" = b.id and m."userId" = a."userId" and m.status = 'active')) as company
     from "drinkAnswer" a join "user" u on u.id = a."userId" join business b on b.id = $2
     where a."questionId" = any($1::uuid[]) and u.username is not null and not exists(select 1 from "userBlock" ub where ub."userId" = u.id)
       and ${notBlockedBy('$3::text', 'a."userId"')}
     order by a."createdAt", a.id`, [rows.map(row => row.id), businessId, viewerId]), loadAllCatalogGroups()]);
  const covers = new Map(groups.map(group => [JSON.stringify([group.brand, group.flavor]), group.coverImageUrl ?? null]));
  return {
    total: rows[0]!.total,
    items: rows.map(({ total: _total, ...row }) => ({
      ...row, name: `${row.brand} · ${flavorName(row.flavor)}`, slug: catalogGroupSlug(row.brand, row.flavor),
      cover: covers.get(JSON.stringify([row.brand, row.flavor])) ?? null,
      answers: answers.rows.filter(answer => answer.questionId === row.id).map(({ questionId: _question, ...answer }) => answer),
    })),
  };
}

/** Questions the company hasn't answered yet, for the sidebar's badge. */
export async function countUnansweredQuestions(businessId: string, viewerId: string): Promise<{ unanswered: number; all: number }> {
  const { rows: [row] } = await getPool().query<{ unanswered: number; all: number }>(
    `select count(*) filter (where not answered)::int as unanswered, count(*)::int as "all" from (${QUESTIONS}) q`, [businessId, viewerId]);
  return { unanswered: row?.unanswered ?? 0, all: row?.all ?? 0 };
}

/**
 * The company's answer from the cabinet: the owner or a manager of an approved company, about the company's approved
 * drink. The answer is an ordinary `drinkAnswer` (`answerDrinkQuestion`: nickname, pause, freeze and blocks hold), so
 * the drink page shows it with the company's name and the asker hears about it.
 */
export async function answerBusinessQuestion(userId: string, questionId: string, input: unknown): Promise<{ brand: string; flavor: string }> {
  if (!isContentId(questionId)) throw new BusinessError('Вопрос не найден.');
  const cabinet = await getCabinet(userId);
  const business = cabinet?.business;
  if (!business || business.status !== 'approved') throw new BusinessError('Отвечать может подтверждённая компания.');
  if (cabinet.role === 'analyst') throw new BusinessError('У роли «Аналитик» только просмотр — отвечать могут владелец и менеджеры.');
  const frozen = await frozenMessage(userId);
  if (frozen) throw new BusinessError(frozen);
  const owned = (await getPool().query<{ brand: string; flavor: string }>(`select q.brand, q.flavor from "drinkQuestion" q
    join "businessDrink" d on d.brand = q.brand and d.flavor = q.flavor and d."businessId" = $2 and d.status = 'approved'
    where q.id = $1`, [questionId, business.id])).rows[0];
  if (!owned) throw new BusinessError('Можно ответить только на вопрос о подтверждённом напитке компании.');
  const answer = await answerDrinkQuestion(userId, questionId, input);
  await logBusiness(business.id, userId, 'question-answer', `${owned.brand} · ${flavorName(owned.flavor)}`);
  return answer;
}
