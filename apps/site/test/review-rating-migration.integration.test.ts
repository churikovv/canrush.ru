import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { expect, it } from 'vitest';

it('converts historical ratings without losing reviews, photos, timestamps or blocked authors; retains the moderation guard', async () => {
  const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
  if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Only canrush_site_test is allowed');
  const pool = new Pool({ connectionString: url, max: 1 });
  const client = await pool.connect();
  try {
    await client.query('begin');
    const schema = `rating_test_${randomUUID().replaceAll('-', '')}`;
    await client.query(`create schema "${schema}"`);
    await client.query(`set local search_path to "${schema}"`);
    await client.query('create table "user" (id text primary key); insert into "user" values (\'a\'), (\'blocked\')');
    await client.query(await readFile(new URL('../migrations/0003_reviews.sql', import.meta.url), 'utf8'));
    await client.query(`create table "reviewPhoto" (id text primary key, "reviewId" uuid references review(id), data bytea);
      insert into review ("userId",brand,flavor,design,taste,composition,text,"createdAt","updatedAt") values
      ('a','Burn','original',4,5,1,'Preserved text','2026-01-01','2026-02-02'),
      ('blocked','Burn','original',1,2,5,'Blocked review','2026-01-01','2026-02-02');
      insert into "reviewPhoto" select 'photo',id,decode('010203','hex') from review where "userId"='a';
      create function guard() returns trigger language plpgsql as $$ begin
        if new."userId"='blocked' then raise exception 'blocked' using errcode='42501'; end if; return new;
      end $$;
      create trigger review_prevent_blocked_contribution before insert or update on review for each row execute function guard();`);
    const before = (await client.query('select * from review order by "userId"')).rows;
    const photos = (await client.query('select * from "reviewPhoto"')).rows;
    await client.query(await readFile(new URL('../migrations/0012_review_rating_ten.sql', import.meta.url), 'utf8'));
    const after = (await client.query('select * from review order by "userId"')).rows;
    expect(after).toHaveLength(before.length);
    for (let i = 0; i < before.length; i++) {
      const old = before[i]!;
      expect(after[i]).toEqual({ ...old, design: old.design * 2, taste: old.taste * 2,
        legacyRatings: { scale: 5, design: old.design, taste: old.taste, composition: old.composition } });
    }
    expect((await client.query('select * from "reviewPhoto"')).rows).toEqual(photos);
    await client.query(`insert into review ("userId",brand,flavor,design,taste,text) values ('a','New','original',10,1,'New review')`);
    expect((await client.query(`select composition,"legacyRatings" from review where brand='New'`)).rows[0]).toEqual({ composition: null, legacyRatings: null });
    await client.query(`update review set design=7,taste=9 where "userId"='a' and brand='Burn'`);
    expect((await client.query(`select "legacyRatings" from review where "userId"='a' and brand='Burn'`)).rows[0]?.legacyRatings).toEqual(after[0]?.legacyRatings);
    for (const sql of ["update review set taste=11 where brand='New'", "update review set design=0 where brand='New'", "update review set taste=10 where \"userId\"='blocked'"]) {
      await client.query('savepoint invalid');
      await expect(client.query(sql)).rejects.toThrow();
      await client.query('rollback to savepoint invalid');
    }
  } finally { await client.query('rollback'); client.release(); await pool.end(); }
});
