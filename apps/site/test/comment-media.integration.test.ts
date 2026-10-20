import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Test DB only');
const pool = new Pool({ connectionString: url, max: 3 });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
const walls = await import('../src/lib/wall-discussions');
const { serveStoredMedia } = await import('../src/lib/media-response');
const [owner, reader] = [randomUUID(), randomUUID()];
let post: string;
beforeAll(async () => {
  for (const id of [owner, reader]) await pool.query(`insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt") values($1,'Media test',$2,true,now(),now())`, [id, `${id}@example.com`]);
  post = (await pool.query(`insert into "profileComment"("userId","profileId",text) values($1,$1,'Post') returning id`, [owner])).rows[0].id;
});
afterAll(async () => { await pool.query('delete from "user" where id = any($1::text[])', [[owner, reader]]); await pool.end(); });

it('stores comment attachments in order, lists them with the thread, serves them and drops them with the comment', async () => {
  const image = { kind: 'image' as const, mime: 'image/webp' as const, data: Buffer.from('full-image'), thumbnail: Buffer.from('thumb') };
  const video = { kind: 'video' as const, mime: 'video/mp4' as const, data: Buffer.from('0123456789'), thumbnail: Buffer.from('poster') };
  await walls.addWallComment(reader, post, 'Смотри', undefined, [image, video]);
  const [comment] = (await walls.getWallComments(post, reader)).items;
  expect(comment?.media.map(item => item.kind)).toEqual(['image', 'video']);
  const [photoId, videoId] = comment!.media.map(item => item.id) as [string, string];
  expect(Buffer.from(await (await serveStoredMedia(new Request('http://x/'), 'commentMedia', photoId)).arrayBuffer()).toString()).toBe('full-image');
  expect(Buffer.from(await (await serveStoredMedia(new Request('http://x/?size=thumbnail'), 'commentMedia', photoId)).arrayBuffer()).toString()).toBe('thumb');
  const ranged = await serveStoredMedia(new Request('http://x/', { headers: { range: 'bytes=2-5' } }), 'commentMedia', videoId);
  expect(ranged.status).toBe(206);
  expect(Buffer.from(await ranged.arrayBuffer()).toString()).toBe('2345');
  await walls.deleteWallComment(reader, post, comment!.id);
  expect((await pool.query('select count(*)::int as n from "commentMedia" where id = any($1::uuid[])', [[photoId, videoId]])).rows[0].n).toBe(0);
});

it('accepts a comment that is only an attachment and refuses an empty one, in the app and in the database', async () => {
  const image = { kind: 'image' as const, mime: 'image/webp' as const, data: Buffer.from('only-photo'), thumbnail: Buffer.from('t') };
  await pool.query('update "user" set "lastWallReplyAt" = null where id = $1', [reader]); // the first test's comment started the 30 s pause
  await expect(walls.addWallComment(reader, post, '   ')).rejects.toThrow('прикрепите');
  await walls.addWallComment(reader, post, '  ', undefined, [image]);
  const [comment] = (await walls.getWallComments(post, reader)).items;
  expect(comment).toMatchObject({ text: '', media: [{ kind: 'image' }] });
  // The deferred check runs at commit: an empty comment without attachments never lands.
  await expect(pool.query(`insert into "wallReply" ("wallPostId","userId",text) values ($1,$2,'')`, [post, owner])).rejects.toThrow('text or an attachment');
});
