import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';

const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Only test database allowed');
const pool = new Pool({ connectionString: url, max: 3 });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
const { blockMember, getBlockedMembers, isBlockedByViewer, isMemberBlockedError, unblockMember } = await import('../src/lib/member-blocks');
const { getFeed, getProfileWall } = await import('../src/lib/profile-community');
const { getWallComments } = await import('../src/lib/wall-discussions');

const run = randomUUID().replaceAll('-', '').slice(0, 10);
const [blocker, blocked, bystander] = [randomUUID(), randomUUID(), randomUUID()];
const post = (author: string, wall: string, text: string) =>
  pool.query<{ id: string }>('insert into "profileComment" ("profileId","userId",text) values ($1,$2,$3) returning id', [wall, author, text]).then(result => result.rows[0]!.id);
const blockedError = (promise: Promise<unknown>) => promise.then(() => false, error => isMemberBlockedError(error));

beforeAll(async () => {
  for (const [index, id] of [blocker, blocked, bystander].entries()) {
    await pool.query('insert into "user" (id,name,email,username,"emailVerified","createdAt","updatedAt") values ($1,$2,$3,$4,true,now(),now())', [id, `Участник ${index}`, `${id}@example.com`, `mb${index}${run}`]);
  }
  await pool.query('insert into "userFollow" ("userId","targetId") values ($1,$2),($2,$1)', [blocker, blocked]);
});
afterAll(async () => {
  await pool.query('delete from "user" where id = any($1::text[])', [[blocker, blocked, bystander]]);
  await pool.end();
});

it('blocks a member, drops follows both ways and lists the block', async () => {
  expect(await blockMember(blocker, blocker)).toBe(false);
  expect(await blockMember(blocker, 'missing-user')).toBe(false);
  expect(await blockMember(blocker, blocked)).toBe(true);
  expect(await blockMember(blocker, blocked)).toBe(true);
  expect((await pool.query('select 1 from "userFollow" where "userId" = any($1::text[])', [[blocker, blocked]])).rowCount).toBe(0);
  expect(await isBlockedByViewer(blocker, blocked)).toBe(true);
  expect((await getBlockedMembers(blocker)).map(member => member.id)).toEqual([blocked]);
});

it('closes interactions both ways and drops notifications from the blocked member', async () => {
  expect(await blockedError(post(blocked, blocker, 'на стене'))).toBe(true);
  expect(await blockedError(post(blocker, blocked, 'и обратно'))).toBe(true);
  expect(await blockedError(pool.query('insert into "userFollow" ("userId","targetId") values ($1,$2)', [blocked, blocker]))).toBe(true);
  const own = await post(blocker, blocker, 'своя запись');
  expect(await blockedError(pool.query('insert into "wallReply" ("wallPostId","userId",text) values ($1,$2,$3)', [own, blocked, 'ответ']))).toBe(true);
  await pool.query(`insert into notification ("userId","actorId",kind,"eventKey") values ($1,$2,'follow',$3)`, [blocker, blocked, `block:${run}`]);
  expect((await pool.query('select 1 from notification where "eventKey" = $1', [`block:${run}`])).rowCount).toBe(0);
});

it('hides the blocked member from the blocker only', async () => {
  const theirs = await post(blocked, blocked, `запись ${run}`);
  const shared = await post(bystander, bystander, 'общая запись');
  await pool.query('insert into "wallReply" ("wallPostId","userId",text) values ($1,$2,$3)', [shared, blocked, `ответ ${run}`]);

  const feedIds = async (viewer: string) => (await getFeed(viewer, 'all', 1)).posts.map(item => item.id);
  expect(await feedIds(blocker)).not.toContain(theirs);
  expect(await feedIds(bystander)).toContain(theirs);
  expect((await getProfileWall(blocked, 1, blocker)).comments).toHaveLength(0);
  expect((await getProfileWall(blocked, 1, bystander)).comments.map(item => item.id)).toEqual([theirs]);
  expect((await getWallComments(shared, blocker)).items).toHaveLength(0);
  expect((await getWallComments(shared, bystander)).items.map(item => item.text)).toEqual([`ответ ${run}`]);
});

it('unblocking opens interactions again', async () => {
  await unblockMember(blocker, blocked);
  await pool.query('insert into "userFollow" ("userId","targetId") values ($1,$2)', [blocked, blocker]);
  expect(await isBlockedByViewer(blocker, blocked)).toBe(false);
});
