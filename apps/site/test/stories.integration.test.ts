import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Test DB only');
const pool = new Pool({ connectionString: url, max: 4 });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
const stories = await import('../src/lib/stories');
const digest = await import('../src/lib/story-digest');

const author = randomUUID(), viewer = randomUUID(), blocker = randomUUID(), banned = randomUUID(), noNick = randomUUID();
const media = [{ kind: 'image' as const, mime: 'image/webp' as const, data: Buffer.from('story'), thumbnail: Buffer.from('thumb') }];
const brand = `Тест ${randomUUID().slice(0, 8)}`;

beforeAll(async () => {
  for (const id of [author, viewer, blocker, banned, noNick]) await pool.query(
    `insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt",username) values($1,'Stories test',$2,true,now(),now(),$3)`,
    [id, `${id}@example.com`, id === noNick ? null : `st_${id.slice(0, 12)}`]);
  await pool.query(`insert into "userBlock"("userId") values($1)`, [banned]);
  await pool.query(`insert into "memberBlock"("blockerId","blockedId") values($1,$2)`, [blocker, author]);
});
afterAll(async () => {
  await pool.query('delete from review where brand = $1', [brand]);
  await pool.query('delete from favorite where brand = any($1::text[])', [[brand, `${brand} 2`]]);
  await pool.query('delete from "user" where id = any($1::text[])', [[author, viewer, blocker, banned, noNick]]);
  await pool.end();
});

it('publishes a story with one attachment, limits a day and needs a nickname and an unblocked account', async () => {
  const id = await stories.publishStory(author, '  Первая   история ', media);
  expect((await pool.query('select caption from "story" where id = $1', [id])).rows[0]).toEqual({ caption: 'Первая история' });
  await expect(stories.publishStory(author, '', [])).rejects.toThrow('одно фото');
  await expect(stories.publishStory(banned, '', media)).rejects.toThrow('заблокирован');
  await expect(stories.publishStory(noNick, '', media)).rejects.toThrow('ник');
  await pool.query(`insert into "story"("userId",kind,mime,data,thumbnail) select $1,'image','image/webp','x','x' from generate_series(1,9)`, [author]);
  await expect(stories.publishStory(author, '', media)).rejects.toThrow('Не больше');
});

it('groups active stories, tracks views and hides authors the viewer blocked', async () => {
  const [groupForViewer] = (await stories.getStoryGroups(viewer)).filter(group => group.author.id === author);
  expect(groupForViewer).toMatchObject({ own: false, seen: false });
  await stories.markStoriesViewed(viewer, groupForViewer!.stories.map(story => story.id));
  const [seenGroup] = (await stories.getStoryGroups(viewer)).filter(group => group.author.id === author);
  expect(seenGroup!.seen).toBe(true);
  expect((await stories.getStoryGroups(blocker)).some(group => group.author.id === author)).toBe(false);
  expect((await stories.getStoryGroups(author))[0]).toMatchObject({ own: true });
  // A story older than a day is gone from the row and from /api/story-media.
  const old = (await pool.query<{ id: string }>(`insert into "story"("userId",kind,mime,data,thumbnail,"createdAt") values($1,'image','image/webp','x','x',now() - interval '25 hours') returning id`, [viewer])).rows[0]!.id;
  expect(await stories.isStoryVisible(old)).toBe(false);
  expect((await stories.getStoryGroups(null)).some(group => group.author.id === viewer)).toBe(false);
  await expect(stories.deleteStory(viewer, groupForViewer!.stories[0]!.id)).rejects.toThrow('не найдена');
  await stories.deleteStory(author, groupForViewer!.stories[0]!.id);
});

it('likes another member\'s story once, never one\'s own or across a block, and shows the author who liked', async () => {
  const id = (await pool.query<{ id: string }>(`insert into "story"("userId",kind,mime,data,thumbnail) values($1,'image','image/webp','x','x') returning id`, [author])).rows[0]!.id;
  expect(await stories.setStoryLike(viewer, id, true)).toBe(1);
  expect(await stories.setStoryLike(viewer, id, true)).toBe(1);
  await expect(stories.setStoryLike(author, id, true)).rejects.toThrow('недоступна');
  await expect(stories.setStoryLike(blocker, id, true)).rejects.toThrow('недоступна');
  await expect(stories.setStoryLike(banned, id, true)).rejects.toThrow('недоступна');
  const story = (groups: Awaited<ReturnType<typeof stories.getStoryGroups>>) => groups.flatMap(group => group.stories).find(item => item.id === id);
  expect(story(await stories.getStoryGroups(viewer))).toMatchObject({ likes: 1, liked: true, views: 0 });
  await stories.markStoriesViewed(viewer, [id]);
  expect(story(await stories.getStoryGroups(author))).toMatchObject({ likes: 1, liked: false, views: 1 });
  expect((await stories.getStoryLikers(author, id)).map(person => person.username)).toEqual([`st_${viewer.slice(0, 12)}`]);
  expect(await stories.getStoryLikers(viewer, id)).toEqual([]);
  expect(await stories.setStoryLike(viewer, id, false)).toBe(0);
});

it('builds the weekly digest and suggests what similar members like', async () => {
  const week = await digest.getWeeklyDigest(viewer);
  expect(week).toMatchObject({ cans: 0, days: 0, reviews: 0, daily: [0, 0, 0, 0, 0, 0, 0] });
  // A can today counts in the last day of the week strip.
  await pool.query(`insert into "drinkLog"("userId",day,name) values($1,(now() at time zone 'Europe/Moscow')::date,'Тестовая банка')`, [viewer]);
  const logged = await digest.getWeeklyDigest(viewer);
  expect(logged).toMatchObject({ cans: 1, days: 1, favorite: { name: 'Тестовая банка', count: 1, brand: null } });
  expect(logged.daily.at(-1)).toBe(1);
  // The home page shows the finished week: a can today is not in the week that ended yesterday.
  const yesterday = new Date(Date.now() - 86_400_000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' });
  expect(await digest.getWeeklyDigest(viewer, yesterday)).toMatchObject({ cans: 0, to: yesterday });
  // The author shares three favourites with the viewer and also loves a fourth drink the viewer has not tried.
  const flavors = ['apple', 'mango', 'peach', 'cherry'];
  for (const flavor of flavors.slice(0, 3)) for (const id of [viewer, author]) await pool.query('insert into favorite("userId",brand,flavor) values($1,$2,$3)', [id, brand, flavor]);
  await pool.query('insert into favorite("userId",brand,flavor) values($1,$2,$3)', [author, brand, 'cherry']);
  const groups = flavors.map(flavor => ({ brand, flavor, variants: [], minPrice: 100 }));
  const picks = await digest.getRecommendations(viewer, groups);
  expect(picks.basis).toBe('community');
  expect(picks.items).toEqual([]);
  // With three similar fans' drinks in the catalog the picks come from similar members.
  // At most two picks per brand, so the third comes from another brand the neighbour likes.
  const other = `${brand} 2`;
  for (const flavor of ['lime', 'grape']) await pool.query('insert into favorite("userId",brand,flavor) values($1,$2,$3)', [author, other, flavor]);
  const similar = await digest.getRecommendations(viewer, [...groups, ...['lime', 'grape'].map(flavor => ({ brand: other, flavor, variants: [], minPrice: 100 }))]);
  expect(similar.basis).toBe('similar');
  expect(similar.items.map(item => item.href).sort()).toHaveLength(3);
  // One neighbour, all six drinks of one brand: the picks are explained by the neighbour or by the brand.
  expect(similar.items.every(item => item.reason.kind === 'similar' || item.reason.kind === 'brand')).toBe(true);
});
