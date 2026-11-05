import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Test DB only');
const pool = new Pool({ connectionString: url, max: 4 });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
// The drink catalog behind the shared drinks is a file read; the suggestions only need names for the covers.
vi.mock('../src/lib/wall-drinks', () => ({ drinkCatalog: async () => new Map() }));
const people = await import('../src/lib/people-suggestions');

const viewer = randomUUID(), twin = randomUUID(), active = randomUUID(), quiet = randomUUID(), blocked = randomUUID(), followed = randomUUID(), veteran = randomUUID();
const all = [viewer, twin, active, quiet, blocked, followed, veteran];
const brand = `Люди ${randomUUID().slice(0, 8)}`;

beforeAll(async () => {
  for (const id of all) await pool.query(
    `insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt",username,"lastSeenAt") values($1,'People test',$2,true,$3,now(),$4,$5)`,
    [id, `${id}@example.com`, id === veteran ? new Date(Date.now() - 90 * 86_400_000) : new Date(), `pp_${id.slice(0, 8)}`, id === quiet ? new Date(Date.now() - 60 * 86_400_000) : new Date()]);
  await pool.query(`insert into "profileExperience"("userId", reason, "sourceKey", points) values ($1, 'achievement', 'people-test', 100)`, [veteran]);
  // The viewer and the twin like the same three drinks; the others share nothing.
  for (const id of [viewer, twin]) for (const flavor of ['a', 'b', 'c']) await pool.query('insert into favorite("userId", brand, flavor) values ($1, $2, $3)', [id, brand, flavor]);
  for (const id of [blocked, followed]) for (const flavor of ['a', 'b', 'c']) await pool.query('insert into favorite("userId", brand, flavor) values ($1, $2, $3)', [id, brand, flavor]);
  await pool.query('insert into "memberBlock"("blockerId", "blockedId") values ($1, $2)', [blocked, viewer]);
  await pool.query('insert into "userFollow"("userId", "targetId") values ($1, $2)', [viewer, followed]);
});
afterAll(async () => {
  await pool.query('delete from "user" where id = any($1::text[])', [all]);
  await pool.end();
});

it('offers someone with a similar taste first, then active members, never blocked, followed or quiet ones', async () => {
  const [first] = await people.getPeopleSuggestions(viewer, 1);
  expect(first).toMatchObject({ id: twin, reason: { kind: 'taste', shared: 3 } });
  const many = await people.getPeopleSuggestions(viewer, 50);
  const ids = many.map(person => person.id);
  expect(ids[0]).toBe(twin);
  expect(ids).toContain(active);
  expect(ids).not.toContain(viewer);
  expect(ids).not.toContain(blocked);
  expect(ids).not.toContain(followed);
  expect(ids).not.toContain(quiet);
  expect(many.find(person => person.id === active)?.reason.kind).toBe('active');
});

it('leaves out people shown in this visit and skipped ones until taken back', async () => {
  expect((await people.getPeopleSuggestions(viewer, 1, [twin]))[0]?.id).not.toBe(twin);
  await people.skipPerson(viewer, twin);
  expect((await people.getPeopleSuggestions(viewer, 50)).map(person => person.id)).not.toContain(twin);
  await people.unskipPerson(viewer, twin);
  expect((await people.getPeopleSuggestions(viewer, 1))[0]?.id).toBe(twin);
});

it('brings person cards sooner to a newcomer', async () => {
  expect(await people.peopleSchedule(viewer)).toEqual(people.PEOPLE_AT.newcomer);
  expect(await people.peopleSchedule(veteran)).toEqual(people.PEOPLE_AT.member);
});
