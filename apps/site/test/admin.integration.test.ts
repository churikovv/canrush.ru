import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';

const DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
const pool = new Pool({ connectionString: DATABASE_URL, max: 1, allowExitOnIdle: true });
const runId = randomUUID();
const userId = `moderation-${runId}`;

beforeAll(async () => {
  const schema = await pool.query(`
    select
      to_regclass('"siteAdmin"')::text as admin,
      to_regclass('"userBlock"')::text as block,
      to_regclass('"adminAuditLog"')::text as audit
  `);
  if (!schema.rows[0]?.admin || !schema.rows[0]?.block || !schema.rows[0]?.audit) {
    throw new Error('Run the test database migration first');
  }
});

afterAll(async () => {
  await pool.query('delete from "user" where "id" = $1', [userId]);
  await pool.end();
});

describe.sequential('admin moderation schema', () => {
  it('keeps the bootstrap owner protected', async () => {
    const result = await pool.query<{ email: string; isOwner: boolean }>(
      'select "email", "isOwner" from "siteAdmin" where "email" = $1',
      ['sobik.steam@yandex.ru'],
    );
    expect(result.rows[0]).toEqual({ email: 'sobik.steam@yandex.ru', isOwner: true });
  });

  it('blocks new reviews and tier lists at the database boundary', async () => {
    await pool.query(
      `insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
       values ($1, 'Blocked member', $2, true, current_timestamp, current_timestamp)`,
      [userId, `${runId}@example.com`],
    );
    await pool.query('insert into "userBlock" ("userId") values ($1)', [userId]);

    await expect(
      pool.query(
        `insert into "review" ("userId", "brand", "flavor", "design", "taste", "composition", "text")
         values ($1, 'Test', 'blocked', 4, 4, 4, 'Blocked')`,
        [userId],
      ),
    ).rejects.toMatchObject({ code: '42501' });

    await expect(
      pool.query(
        `insert into "tierList" ("userId", "slug", "title")
         values ($1, $2, 'Blocked')`,
        [userId, `tier-${runId}`],
      ),
    ).rejects.toMatchObject({ code: '42501' });
  });
});
