import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';

const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Only test database allowed');
const pool = new Pool({ connectionString: url, max: 3 });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
const { addProfileComment, getProfileWall, CommunityError } = await import('../src/lib/profile-community');
const { addWallComment, getWallComments, WallDiscussionError } = await import('../src/lib/wall-discussions');
const { drinkCatalog } = await import('../src/lib/wall-drinks');

const run = randomUUID().replaceAll('-', '').slice(0, 10);
const [author, reader] = [randomUUID(), randomUUID()];
let drink = { brand: '', flavor: '' };

beforeAll(async () => {
  for (const [index, id] of [author, reader].entries()) {
    await pool.query('insert into "user" (id,name,email,username,"emailVerified","createdAt","updatedAt") values ($1,$2,$3,$4,true,now(),now())', [id, `Напиток ${index}`, `${id}@example.com`, `wd${index}${run}`]);
  }
  const first = [...(await drinkCatalog()).values()][0]!;
  drink = { brand: first.brand, flavor: first.flavor };
});
afterAll(async () => {
  await pool.query('delete from "user" where id = any($1::text[])', [[author, reader]]);
  await pool.end();
});

it('keeps a catalog drink on a wall record, even one without text, and shows its name and link', async () => {
  await addProfileComment(author, author, `пробую ${run}`, [], drink);
  await pool.query(`update "user" set "lastWallPostAt" = null where id = $1`, [author]);
  await addProfileComment(author, author, '', [], drink);
  const wall = await getProfileWall(author, 1, author);
  expect(wall.comments).toHaveLength(2);
  for (const post of wall.comments) {
    expect(post.drink).toMatchObject({ brand: drink.brand, flavor: drink.flavor });
    expect(post.drink?.href).toMatch(/^\/catalog\//);
  }
});

it('refuses a drink that is not in the catalog and an empty record', async () => {
  await pool.query(`update "user" set "lastWallPostAt" = null where id = $1`, [author]);
  await expect(addProfileComment(author, author, 'текст', [], { brand: 'Нет такого', flavor: run })).rejects.toBeInstanceOf(CommunityError);
  await expect(addProfileComment(author, author, '', [], null)).rejects.toThrow('напиток');
});

it('keeps a drink on a comment under a record, alone too', async () => {
  const post = (await getProfileWall(author, 1, author)).comments[0]!.id;
  await addWallComment(reader, post, '', undefined, [], drink);
  const thread = await getWallComments(post, reader);
  expect(thread.items[0]?.drink).toMatchObject({ brand: drink.brand, flavor: drink.flavor });
  await pool.query(`update "user" set "lastWallReplyAt" = null where id = $1`, [reader]);
  await expect(addWallComment(reader, post, '', undefined, [], { brand: 'Нет такого', flavor: run })).rejects.toBeInstanceOf(WallDiscussionError);
  await expect(addWallComment(reader, post, '   ', undefined, [], null)).rejects.toThrow('напиток');
});

it('moves the drink of records and comments when drinks are merged', async () => {
  const target = { brand: `Склейка ${run}`, flavor: 'merged' };
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('select move_drink_identity($1, $2, $3, $4)', [drink.brand, drink.flavor, target.brand, target.flavor]);
    const moved = await client.query<{ posts: number; replies: number }>(`select
      (select count(*)::int from "profileComment" where "userId" = $1 and "drinkBrand" = $3 and "drinkFlavor" = $4) as posts,
      (select count(*)::int from "wallReply" where "userId" = $2 and "drinkBrand" = $3 and "drinkFlavor" = $4) as replies`, [author, reader, target.brand, target.flavor]);
    expect(moved.rows[0]).toEqual({ posts: 2, replies: 1 });
  } finally {
    // Other runs and the real catalog drinks must not move: the merge is only looked at, then undone.
    await client.query('rollback');
    client.release();
  }
  // A drink that has left the catalog keeps its name, without a link.
  await pool.query(`update "profileComment" set "drinkBrand" = $2 where "userId" = $1`, [author, `Ушёл ${run}`]);
  const post = (await getProfileWall(author, 1, author)).comments[0]!;
  expect(post.drink?.label).toContain(`Ушёл ${run}`);
  expect(post.drink?.href).toBeUndefined();
});
