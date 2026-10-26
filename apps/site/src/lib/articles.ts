import { getPool } from '@/db/pool';
import {
  ARTICLE_ID_PATTERN, ARTICLE_IMAGES_MAX, ArticleError, MAX_PENDING_ARTICLES, articleReadiness, articleSummary, readingMinutes,
  type ArticleBlock, type ArticleStatus,
} from '@/lib/article-fields';
import { catalogGroupSlug } from '@/lib/catalog-query';
import { frozenMessage, isUserBlocked } from '@/lib/moderation';
import type { PreparedReviewPhoto } from '@/lib/review-photos';
import { storeDrinkOptions } from '@/lib/store-catalog';

export interface ArticleAuthor { id: string; name: string; username: string | null; avatarId: string | null }
export interface Article {
  id: string; title: string; blocks: ArticleBlock[]; coverId: string | null; telegramChannel: string | null; status: ArticleStatus; moderationNote: string;
  submittedAt: Date | null; publishedAt: Date | null; createdAt: Date; updatedAt: Date; version: string; author: ArticleAuthor;
  likes: number; liked: boolean;
}
export interface ArticleCard {
  id: string; title: string; summary: string; minutes: number; coverId: string | null; status: ArticleStatus; moderationNote: string;
  publishedAt: Date | null; updatedAt: Date; author: ArticleAuthor; likes: number; liked: boolean; telegramChannel: string | null;
}
/** A drink block as the page shows it: catalog name, cover and link, or nothing if the drink left the catalog. */
export interface ArticleDrink { label: string; href: string; cover?: string }

const STAFF = (user: string) => `exists(select 1 from "user" su join "siteAdmin" sa on lower(su.email) = sa.email where su.id = ${user})`;
const VISIBLE_AUTHOR = 'not exists(select 1 from "userBlock" b where b."userId" = a."authorId")';
const COLUMNS = `a.id, a.title, a.blocks, a."coverId", a."telegramChannel", a.status, a."moderationNote", a."submittedAt", a."publishedAt", a."createdAt", a."updatedAt",
  to_char(a."updatedAt" at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US') as version,
  (select count(*)::int from "articleLike" l where l."articleId" = a.id) as likes,
  json_build_object('id', u.id, 'name', u.name, 'username', u.username,
    'avatarId', (select p.id::text from "profileImage" p where p."userId" = u.id and p.kind = 'avatar')) as author`;
type Row = Omit<Article, 'liked'> & { liked?: boolean };

const card = (row: Row): ArticleCard => ({
  id: row.id, title: row.title, summary: articleSummary(row.blocks), minutes: readingMinutes(row.blocks), coverId: row.coverId, status: row.status,
  moderationNote: row.moderationNote, publishedAt: row.publishedAt, updatedAt: row.updatedAt, author: row.author, likes: row.likes,
  liked: row.liked === true, telegramChannel: row.telegramChannel,
});

/**
 * Keeps only what may stay in a saved document: photos uploaded to this very article and drinks still in the catalog.
 * The cover must be one of the article's photos too.
 */
async function cleanBlocks(articleId: string | null, blocks: ArticleBlock[], coverId: string | null) {
  const images = articleId ? new Set((await getPool().query<{ id: string }>('select id::text from "articleImage" where "articleId" = $1', [articleId])).rows.map(row => row.id)) : new Set<string>();
  const drinks = blocks.some(block => block.type === 'drink') ? new Set((await storeDrinkOptions()).map(option => JSON.stringify([option.brand, option.flavor]))) : new Set<string>();
  return {
    blocks: blocks.filter(block => block.type === 'image' ? images.has(block.imageId) : block.type === 'drink' ? drinks.has(JSON.stringify([block.brand, block.flavor])) : true),
    coverId: coverId && images.has(coverId) ? coverId : null,
  };
}

/**
 * Saves the author's draft (autosave). A new article is created on the first save. Only drafts and rejected articles
 * are edited: a rejected one becomes a draft again (its note stays until the next review); a pending or published one
 * is first taken back with `reopenArticle`. `version` guards against a second tab overwriting newer text.
 */
export async function saveArticleDraft(userId: string, id: string | null, title: string, input: ArticleBlock[], cover: string | null, version: string | null, channel: string | null = null): Promise<{ id: string; version: string }> {
  if (await isUserBlocked(userId)) throw new ArticleError('Статьи для этого аккаунта ограничены.');
  const { blocks, coverId } = await cleanBlocks(id, input, cover);
  if (!id) {
    const count = (await getPool().query<{ drafts: number; recent: boolean }>(`select count(*) filter (where status = 'draft')::int as drafts,
      coalesce(bool_or("createdAt" > now() - interval '30 seconds'), false) as recent from article where "authorId" = $1`, [userId])).rows[0]!;
    if (count.drafts >= 30) throw new ArticleError('У вас уже 30 черновиков. Удалите лишние, чтобы начать новую статью.');
    if (count.recent) throw new ArticleError('Подождите немного перед новой статьёй.');
    const created = await getPool().query<{ id: string; version: string }>(`insert into article ("authorId", title, blocks, "telegramChannel") values ($1, $2, $3, $4)
      returning id, to_char("updatedAt" at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US') as version`, [userId, title, JSON.stringify(blocks), channel]);
    return created.rows[0]!;
  }
  if (!ARTICLE_ID_PATTERN.test(id)) throw new ArticleError('Статья не найдена.');
  const result = await getPool().query<{ id: string; version: string }>(`update article set title = $3, blocks = $4, "coverId" = $5,
      "telegramChannel" = $7, status = 'draft', "updatedAt" = clock_timestamp()
    where id = $1 and "authorId" = $2 and status in ('draft', 'rejected')
      and ($6::text is null or to_char("updatedAt" at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US') = $6)
    returning id, to_char("updatedAt" at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US') as version`, [id, userId, title, JSON.stringify(blocks), coverId, version, channel]);
  if (!result.rowCount) {
    const current = (await getPool().query<{ status: ArticleStatus }>('select status from article where id = $1 and "authorId" = $2', [id, userId])).rows[0];
    if (!current) throw new ArticleError('Статья не найдена.');
    if (current.status === 'pending' || current.status === 'published') throw new ArticleError('Статья на проверке или опубликована: верните её в черновики, чтобы править.');
    throw new ArticleError('Статью изменили в другой вкладке. Обновите страницу, чтобы не потерять правки.');
  }
  return result.rows[0]!;
}

/** Sends a draft for review: the same readiness rules as the editor, a cap on pending articles and a short pause. */
export async function submitArticle(userId: string, id: string): Promise<void> {
  if (!ARTICLE_ID_PATTERN.test(id)) throw new ArticleError('Статья не найдена.');
  const frozen = await frozenMessage(userId);
  if (frozen) throw new ArticleError(frozen);
  if (await isUserBlocked(userId)) throw new ArticleError('Статьи для этого аккаунта ограничены.');
  const article = (await getPool().query<{ title: string; blocks: ArticleBlock[]; status: ArticleStatus }>('select title, blocks, status from article where id = $1 and "authorId" = $2', [id, userId])).rows[0];
  if (!article) throw new ArticleError('Статья не найдена.');
  if (article.status === 'pending') throw new ArticleError('Статья уже на проверке.');
  if (article.status === 'published') throw new ArticleError('Статья уже опубликована.');
  const problem = articleReadiness(article.title, article.blocks);
  if (problem) throw new ArticleError(problem);
  const counts = (await getPool().query<{ pending: number; recent: boolean }>(`select count(*) filter (where status = 'pending')::int as pending,
    coalesce(bool_or("submittedAt" > now() - interval '60 seconds'), false) as recent from article where "authorId" = $1`, [userId])).rows[0]!;
  if (counts.pending >= MAX_PENDING_ARTICLES) throw new ArticleError(`На проверке может быть до ${MAX_PENDING_ARTICLES} статей одновременно.`);
  if (counts.recent) throw new ArticleError('Подождите минуту перед отправкой следующей статьи.');
  await getPool().query(`update article set status = 'pending', "submittedAt" = now(), "updatedAt" = clock_timestamp() where id = $1 and "authorId" = $2 and status in ('draft', 'rejected')`, [id, userId]);
}

/** Takes an article back to drafts: a pending one leaves the queue, a published one is hidden until it passes review again. */
export async function reopenArticle(userId: string, id: string): Promise<void> {
  if (!ARTICLE_ID_PATTERN.test(id)) throw new ArticleError('Статья не найдена.');
  const result = await getPool().query(`update article set status = 'draft', "updatedAt" = clock_timestamp() where id = $1 and "authorId" = $2 and status in ('pending', 'published')`, [id, userId]);
  if (!result.rowCount) throw new ArticleError('Статья уже в черновиках. Обновите страницу.');
}

/** The author removes their article; the team removes any, with a line in the audit log. Photos go with it. */
export async function deleteArticle(userId: string, id: string, staffEmail: string | null): Promise<void> {
  if (!ARTICLE_ID_PATTERN.test(id)) throw new ArticleError('Статья не найдена.');
  const db = await getPool().connect();
  try {
    await db.query('begin');
    const result = await db.query<{ authorId: string }>(`delete from article a where a.id = $1 and (a."authorId" = $2 or ${STAFF('$2')}) returning a."authorId"`, [id, userId]);
    if (!result.rowCount) throw new ArticleError('Статья уже удалена.');
    if (staffEmail && result.rows[0]!.authorId !== userId) {
      await db.query('insert into "adminAuditLog" ("adminEmail", action, "targetType", "targetId") values ($1, $2, $3, $4)', [staffEmail, 'delete', 'article', id]);
    }
    await db.query('commit');
  } catch (error) {
    await db.query('rollback');
    throw error;
  } finally { db.release(); }
}

/** Publishes or returns a pending article; the role is checked in SQL, the version guards against a changed text. */
export async function moderateArticle(adminId: string, id: string, status: 'published' | 'rejected', note: string, version: string): Promise<void> {
  if (!['published', 'rejected'].includes(status) || note.length > 500 || (status === 'rejected' && !note.trim())) throw new ArticleError('Для отклонения укажите причину (до 500 символов).');
  const result = await getPool().query(`update article a set status = $3, "moderationNote" = $4, "reviewedBy" = $1, "reviewedAt" = now(),
      "publishedAt" = case when $3 = 'published' then coalesce(a."publishedAt", now()) else a."publishedAt" end, "updatedAt" = clock_timestamp()
    where a.id = $2 and a.status = 'pending' and to_char(a."updatedAt" at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US') = $5
      and ${STAFF('$1')} and ${VISIBLE_AUTHOR} returning a.id`, [adminId, id, status, note.trim(), version]);
  if (!result.rowCount) throw new ArticleError('Статья изменилась, уже проверена или автор заблокирован. Обновите страницу.');
}

/** One article for its page: published ones for everybody, the rest only for the author and the team. */
export async function getArticle(id: string, viewerId: string | null): Promise<Article | null> {
  if (!ARTICLE_ID_PATTERN.test(id)) return null;
  const { rows } = await getPool().query<Row>(`select ${COLUMNS},
      exists(select 1 from "articleLike" l where l."articleId" = a.id and l."userId" = $2) as liked
    from article a join "user" u on u.id = a."authorId"
    where a.id = $1 and ((a.status = 'published' and ${VISIBLE_AUTHOR}) or a."authorId" = $2 or ${STAFF('$2')})`, [id, viewerId]);
  return rows[0] ? { ...rows[0], liked: rows[0].liked === true } : null;
}

/** The «Новости» list: published articles, newest first. */
export async function listPublishedArticles(page = 1, size = 12, viewerId: string | null = null): Promise<{ items: ArticleCard[]; hasMore: boolean }> {
  const { rows } = await getPool().query<Row>(`select ${COLUMNS},
      exists(select 1 from "articleLike" l where l."articleId" = a.id and l."userId" = $3) as liked
    from article a join "user" u on u.id = a."authorId"
    where a.status = 'published' and ${VISIBLE_AUTHOR} order by a."publishedAt" desc, a.id limit $1 offset $2`, [size + 1, (page - 1) * size, viewerId]);
  return { items: rows.slice(0, size).map(card), hasMore: rows.length > size };
}

/** The author's own articles, every status, last edited first. */
export async function listOwnArticles(userId: string): Promise<ArticleCard[]> {
  const { rows } = await getPool().query<Row>(`select ${COLUMNS} from article a join "user" u on u.id = a."authorId"
    where a."authorId" = $1 order by a."updatedAt" desc limit 50`, [userId]);
  return rows.map(card);
}

/** The admin's lists: the queue oldest first, published and rejected newest first. */
export async function listArticlesForAdmin(status: 'pending' | 'published' | 'rejected', page = 1, size = 20): Promise<{ items: ArticleCard[]; hasMore: boolean }> {
  const order = status === 'pending' ? 'a."submittedAt" asc' : 'a."updatedAt" desc';
  const { rows } = await getPool().query<Row>(`select ${COLUMNS} from article a join "user" u on u.id = a."authorId"
    where a.status = $1 and ${VISIBLE_AUTHOR} order by ${order}, a.id limit $2 offset $3`, [status, size + 1, (page - 1) * size]);
  return { items: rows.slice(0, size).map(card), hasMore: rows.length > size };
}

export async function countPendingArticles(): Promise<number> {
  return (await getPool().query<{ count: number }>(`select count(*)::int as count from article a where a.status = 'pending' and ${VISIBLE_AUTHOR}`)).rows[0]?.count ?? 0;
}

/** A photo for the author's article; uploads stop at the article's limit (with some room for a cover and retries). */
export async function addArticleImage(userId: string, articleId: string, photo: PreparedReviewPhoto): Promise<string> {
  if (!ARTICLE_ID_PATTERN.test(articleId)) throw new ArticleError('Сначала сохраните статью.');
  const result = await getPool().query<{ id: string }>(`insert into "articleImage" ("articleId", data, thumbnail)
    select a.id, $3, $4 from article a where a.id = $1 and a."authorId" = $2 and a.status in ('draft', 'rejected')
      and (select count(*) from "articleImage" i where i."articleId" = a.id) < $5
    returning id::text`, [articleId, userId, photo.data, photo.thumbnail, ARTICLE_IMAGES_MAX + 10]);
  if (!result.rowCount) throw new ArticleError(`Не удалось добавить фото: статья не в черновиках или в ней уже ${ARTICLE_IMAGES_MAX} фото.`);
  // Photos uploaded and then removed from the text stay unused; clean them once they are a day old.
  await getPool().query(`delete from "articleImage" i using article a where a.id = i."articleId" and i."articleId" = $1 and i."createdAt" < now() - interval '1 day'
    and i.id <> coalesce(a."coverId", '00000000-0000-0000-0000-000000000000') and not a.blocks @> jsonb_build_array(jsonb_build_object('imageId', i.id::text))`, [articleId]);
  return result.rows[0]!.id;
}

/** A photo as its viewer may see it: of a published article for everybody, otherwise the author and the team. */
export async function getArticleImage(id: string, viewerId: string | null, thumbnail: boolean): Promise<{ data: Buffer; published: boolean } | null> {
  if (!ARTICLE_ID_PATTERN.test(id)) return null;
  const { rows } = await getPool().query<{ data: Buffer; published: boolean }>(`select ${thumbnail ? 'i.thumbnail' : 'i.data'} as data,
      a.status = 'published' and ${VISIBLE_AUTHOR} as published
    from "articleImage" i join article a on a.id = i."articleId"
    where i.id = $1 and ((a.status = 'published' and ${VISIBLE_AUTHOR}) or a."authorId" = $2 or ${STAFF('$2')})`, [id, viewerId]);
  return rows[0] ?? null;
}

/** Catalog names, covers and links for the drink blocks of a document. */
export async function articleDrinks(blocks: readonly ArticleBlock[]): Promise<Record<string, ArticleDrink>> {
  if (!blocks.some(block => block.type === 'drink')) return {};
  const options = new Map((await storeDrinkOptions()).map(option => [JSON.stringify([option.brand, option.flavor]), option]));
  const drinks: Record<string, ArticleDrink> = {};
  for (const block of blocks) {
    if (block.type !== 'drink') continue;
    const option = options.get(JSON.stringify([block.brand, block.flavor]));
    if (option) drinks[block.id] = { label: option.label, href: `/catalog/${catalogGroupSlug(option.brand, option.flavor)}`, ...(option.cover ? { cover: option.cover } : {}) };
  }
  return drinks;
}

/** Published articles for the sitemap: id and last change, nothing else. */
export async function getPublishedArticleSitemapEntries(): Promise<{ id: string; updatedAt: Date }[]> {
  return (await getPool().query<{ id: string; updatedAt: Date }>(`select a.id, a."updatedAt" from article a where a.status = 'published' and ${VISIBLE_AUTHOR} order by a."publishedAt" desc limit 5000`)).rows;
}

/** A like of a published article; not on one's own, not for blocked members. Returns the new count. */
export async function setArticleLike(userId: string, id: string, like: boolean): Promise<{ likes: number; liked: boolean }> {
  if (!ARTICLE_ID_PATTERN.test(id)) throw new ArticleError('Статья не найдена.');
  if (await isUserBlocked(userId)) throw new ArticleError('Действия для этого аккаунта ограничены.');
  const article = (await getPool().query<{ authorId: string }>(`select a."authorId" from article a where a.id = $1 and a.status = 'published' and ${VISIBLE_AUTHOR}`, [id])).rows[0];
  if (!article) throw new ArticleError('Статья не найдена.');
  if (article.authorId === userId) throw new ArticleError('Свою статью лайкнуть нельзя.');
  if (like) await getPool().query('insert into "articleLike" ("articleId", "userId") values ($1, $2) on conflict do nothing', [id, userId]);
  else await getPool().query('delete from "articleLike" where "articleId" = $1 and "userId" = $2', [id, userId]);
  const likes = (await getPool().query<{ count: number }>('select count(*)::int as count from "articleLike" where "articleId" = $1', [id])).rows[0]?.count ?? 0;
  return { likes, liked: like };
}

/** The channel from the author's profile, offered in the editor as «прикрепить свой канал». */
export async function profileChannel(userId: string): Promise<string | null> {
  const value = (await getPool().query<{ channel: string | null }>('select "telegramChannel" as channel from "user" where id = $1', [userId])).rows[0]?.channel ?? null;
  return value && /^[a-z][a-z0-9_]{4,31}$/i.test(value) ? value : null;
}
