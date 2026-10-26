import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Test DB only');
const pool = new Pool({ connectionString: url, max: 4 });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
vi.mock('../src/lib/store-catalog', () => ({ storeDrinkOptions: async () => [{ brand: 'Burn', flavor: 'orange', label: 'Burn · Апельсин', cover: '/images/products/burn.jpg' }] }));
const articles = await import('../src/lib/articles');
const { parseArticleBlocks } = await import('../src/lib/article-fields');

const [author, moderator, reader, banned] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
const moderatorEmail = `${moderator}@example.com`;
const photo = { data: Buffer.from('photo'), thumbnail: Buffer.from('thumb') };
const text = 'Апельсиновый Burn пахнет цедрой и почти не горчит. '.repeat(6);

beforeAll(async () => {
  for (const id of [author, moderator, reader, banned]) await pool.query(
    `insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt",username) values($1,'Articles test',$2,true,now(),now(),$3)`, [id, `${id}@example.com`, `ar_${id.slice(0, 12)}`]);
  await pool.query(`insert into "siteAdmin"(email, role) values($1, 'moderator')`, [moderatorEmail]);
  await pool.query('insert into "userBlock"("userId") values($1)', [banned]);
});
afterAll(async () => {
  await pool.query('delete from "adminAuditLog" where "adminEmail" = $1', [moderatorEmail]);
  await pool.query('delete from "siteAdmin" where email = $1', [moderatorEmail]);
  await pool.query('delete from "user" where id = any($1::text[])', [[author, moderator, reader, banned]]);
  await pool.end();
});

it('saves drafts, keeps only own photos and catalog drinks, and guards against a stale tab', async () => {
  await expect(articles.saveArticleDraft(banned, null, 'Нельзя', [], null, null)).rejects.toThrow('ограничены');
  const draft = await articles.saveArticleDraft(author, null, 'Обзор', parseArticleBlocks([{ type: 'paragraph', text: 'Начало' }]), null, null);
  const image = await articles.addArticleImage(author, draft.id, photo);
  await expect(articles.addArticleImage(reader, draft.id, photo)).rejects.toThrow('Не удалось добавить фото');
  const blocks = parseArticleBlocks([
    { type: 'heading1', text: 'Вкус' }, { type: 'paragraph', text }, { type: 'image', imageId: image, caption: 'Банка' },
    { type: 'image', imageId: randomUUID(), caption: 'Чужое' }, { type: 'drink', brand: 'Burn', flavor: 'orange' }, { type: 'drink', brand: 'Нет', flavor: 'такого' },
  ]);
  const saved = await articles.saveArticleDraft(author, draft.id, 'Обзор Burn', blocks, image, draft.version, 'canrush_news');
  await expect(articles.saveArticleDraft(author, draft.id, 'Старая вкладка', blocks, null, draft.version)).rejects.toThrow('другой вкладке');
  const own = await articles.getArticle(draft.id, author);
  expect(own?.blocks.map(block => block.type)).toEqual(['heading1', 'paragraph', 'image', 'drink']);
  expect(own).toMatchObject({ title: 'Обзор Burn', coverId: image, telegramChannel: 'canrush_news', status: 'draft', version: saved.version });
  // A draft is private: neither another member nor a guest sees it or its photo.
  expect(await articles.getArticle(draft.id, reader)).toBeNull();
  expect(await articles.getArticleImage(image, null, false)).toBeNull();
  expect(await articles.getArticleImage(image, author, true)).toMatchObject({ published: false });
});

it('sends for review, publishes through the team and shows the article to everybody', async () => {
  const empty = await articles.saveArticleDraft(author, null, '', [], null, null).catch(() => null);
  if (empty) await expect(articles.submitArticle(author, empty.id)).rejects.toThrow('заголовок');
  const [own] = (await articles.listOwnArticles(author)).filter(article => article.title === 'Обзор Burn');
  await articles.submitArticle(author, own!.id);
  await expect(articles.saveArticleDraft(author, own!.id, 'Правка', [], null, null)).rejects.toThrow('верните её в черновики');
  const pending = await articles.getArticle(own!.id, moderator);
  expect(pending?.status).toBe('pending');
  expect((await articles.listArticlesForAdmin('pending')).items.some(article => article.id === own!.id)).toBe(true);
  await expect(articles.moderateArticle(reader, own!.id, 'published', '', pending!.version)).rejects.toThrow('Обновите страницу');
  await expect(articles.moderateArticle(moderator, own!.id, 'rejected', ' ', pending!.version)).rejects.toThrow('причину');
  await articles.moderateArticle(moderator, own!.id, 'published', '', pending!.version);
  const published = await articles.getArticle(own!.id, null);
  expect(published).toMatchObject({ status: 'published', title: 'Обзор Burn' });
  expect(published?.publishedAt).toBeInstanceOf(Date);
  expect((await articles.listPublishedArticles()).items.find(article => article.id === own!.id)).toMatchObject({ minutes: 1 });
  expect(await articles.getArticleImage(published!.coverId!, null, false)).toMatchObject({ published: true });
  // Likes: one per member, not on one's own article.
  expect(await articles.setArticleLike(reader, own!.id, true)).toEqual({ likes: 1, liked: true });
  expect(await articles.setArticleLike(reader, own!.id, true)).toEqual({ likes: 1, liked: true });
  await expect(articles.setArticleLike(author, own!.id, true)).rejects.toThrow('Свою статью');
  expect(await articles.getArticle(own!.id, reader)).toMatchObject({ likes: 1, liked: true });
  expect(await articles.articleDrinks(published!.blocks)).toEqual({ [published!.blocks.find(block => block.type === 'drink')!.id]: { label: 'Burn · Апельсин', href: expect.stringMatching(/^\/catalog\//u), cover: '/images/products/burn.jpg' } });
});

it('takes an article back to drafts and lets only the author or the team delete it', async () => {
  const [own] = (await articles.listOwnArticles(author)).filter(article => article.status === 'published');
  await expect(articles.reopenArticle(reader, own!.id)).rejects.toThrow('Обновите страницу');
  await articles.reopenArticle(author, own!.id);
  expect(await articles.getArticle(own!.id, null)).toBeNull();
  await expect(articles.deleteArticle(reader, own!.id, null)).rejects.toThrow('удалена');
  await articles.deleteArticle(moderator, own!.id, moderatorEmail);
  expect(await articles.getArticle(own!.id, author)).toBeNull();
  expect((await pool.query('select count(*)::int as count from "adminAuditLog" where "adminEmail" = $1 and "targetType" = $2', [moderatorEmail, 'article'])).rows[0].count).toBe(1);
  expect((await pool.query('select count(*)::int as count from "articleImage" i join article a on a.id = i."articleId" where a."authorId" = $1', [author])).rows[0].count).toBe(0);
});
