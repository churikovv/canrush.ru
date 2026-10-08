import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { expect, it } from 'vitest';

it('preserves reviews and favorites, deduplicates placements and refuses conflicting reviews', async () => {
  const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
  if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Only test database allowed');
  const pool = new Pool({ connectionString: url, max: 1 });
  const client = await pool.connect();
  try {
    await client.query('begin');
    const schema = 'volt_' + randomUUID().replaceAll('-', '');
    await client.query(`create schema "${schema}"; set local search_path to "${schema}"`);
    await client.query(`
      create table review (id text primary key, "userId" text, brand text, flavor text, text text, unique ("userId",brand,flavor));
      create table favorite ("userId" text, brand text, flavor text, "createdAt" timestamptz, primary key ("userId",brand,flavor));
      create table "favoritePriceWatch" ("userId" text, brand text, flavor text, city text, volume int, price int, "snapshotAt" timestamptz,
        primary key ("userId",brand,flavor,city,volume), foreign key ("userId",brand,flavor) references favorite on delete cascade);
      create table "tierListItem" ("tierListId" text, brand text, flavor text, tier text, position int, primary key ("tierListId",brand,flavor));
      create function guard() returns trigger language plpgsql as $$ begin raise exception 'must be suspended during migration'; end $$;
      insert into review values ('r','u','Volt Energy','blueberry','keep this');
      insert into favorite values ('u','Volt Energy','blueberry',now());
      insert into "favoritePriceWatch" values ('u','Volt Energy','blueberry','moscow',449,9900,now());
      insert into "tierListItem" values ('t','Volt Energy','blueberry','S',2), ('t','Volt Energy','blend:blueberry+pomegranate','A',3);
      create trigger review_prevent_blocked_contribution before update on review for each row execute function guard();
      create trigger favorite_experience after insert on favorite for each row execute function guard();
    `);
    const sql = await readFile(new URL('../migrations/0026_volt_blueberry_alias.sql', import.meta.url), 'utf8');
    await client.query('savepoint before_merge');
    await client.query(sql);
    expect((await client.query('select * from review')).rows).toEqual([{ id: 'r', userId: 'u', brand: 'Volt Energy', flavor: 'blend:blueberry+pomegranate', text: 'keep this' }]);
    for (const table of ['favorite', 'favoritePriceWatch', 'tierListItem']) {
      expect((await client.query(`select flavor from "${table}"`)).rows).toEqual([{ flavor: 'blend:blueberry+pomegranate' }]);
    }
    expect((await client.query('select price from "favoritePriceWatch"')).rows[0].price).toBe(9900);
    await client.query('rollback to savepoint before_merge');
    await client.query("insert into review values ('r2','u','Volt Energy','blend:blueberry+pomegranate','also keep')");
    await client.query('savepoint conflict');
    await expect(client.query(sql)).rejects.toThrow('multiple reviews');
    await client.query('rollback to savepoint conflict');
    expect((await client.query('select id from review')).rowCount).toBe(2);
  } finally { await client.query('rollback'); client.release(); await pool.end(); }
});
