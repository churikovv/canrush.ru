import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { expect, it } from 'vitest';

it('moves member data from archived duplicates onto the live product and refuses conflicting reviews', async () => {
  const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
  if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Only test database allowed');
  const pool = new Pool({ connectionString: url, max: 1 });
  const client = await pool.connect();
  try {
    await client.query('begin');
    const schema = 'duplicates_' + randomUUID().replaceAll('-', '');
    await client.query(`create schema "${schema}"; set local search_path to "${schema}"`);
    await client.query(`
      create table review (id text primary key, "userId" text, brand text, flavor text, text text, unique ("userId",brand,flavor));
      create table favorite ("userId" text, brand text, flavor text, "createdAt" timestamptz, primary key ("userId",brand,flavor));
      create table "favoritePriceWatch" ("userId" text, brand text, flavor text, city text, volume int, price int, "snapshotAt" timestamptz,
        primary key ("userId",brand,flavor,city,volume), foreign key ("userId",brand,flavor) references favorite on delete cascade);
      create table "tierListItem" ("tierListId" text, brand text, flavor text, tier text, position int, primary key ("tierListId",brand,flavor));
      create table "drinkLog" (id text primary key, "userId" text, brand text, flavor text);
      create function guard() returns trigger language plpgsql as $$ begin raise exception 'must be suspended during migration'; end $$;
      insert into review values ('r','u','Burn','apple','keep this'), ('r2','u','Max','original','cross brand');
      insert into favorite values ('u','Burn','apple',now());
      insert into "favoritePriceWatch" values ('u','Burn','apple','moscow',449,9900,now());
      insert into "tierListItem" values ('t','Burn','apple','S',2), ('t','Burn','blend:apple+kiwi','A',3);
      insert into "drinkLog" values ('d','u','Burn','apple'), ('d2','u',null,null);
      create trigger review_prevent_blocked_contribution before update on review for each row execute function guard();
      create trigger favorite_experience after insert on favorite for each row execute function guard();
    `);
    const sql = await readFile(new URL('../migrations/0060_archived_duplicate_aliases.sql', import.meta.url), 'utf8');
    await client.query('savepoint before_merge');
    await client.query(sql);
    expect((await client.query('select id, brand, flavor from review order by id')).rows).toEqual([
      { id: 'r', brand: 'Burn', flavor: 'blend:apple+kiwi' }, { id: 'r2', brand: 'Tornado', flavor: 'tornado_berrycream' }]);
    for (const table of ['favorite', 'favoritePriceWatch', 'tierListItem']) {
      expect((await client.query(`select flavor from "${table}"`)).rows).toEqual([{ flavor: 'blend:apple+kiwi' }]);
    }
    expect((await client.query('select tier from "tierListItem"')).rows).toEqual([{ tier: 'A' }]);
    expect((await client.query('select id, flavor from "drinkLog" order by id')).rows).toEqual([{ id: 'd', flavor: 'blend:apple+kiwi' }, { id: 'd2', flavor: null }]);
    await client.query('rollback to savepoint before_merge');
    await client.query("insert into review values ('r3','u','Burn','blend:apple+kiwi','also keep')");
    await client.query('savepoint conflict');
    await expect(client.query(sql)).rejects.toThrow('manual review conflict');
    await client.query('rollback to savepoint conflict');
    expect((await client.query('select id from review')).rowCount).toBe(3);
  } finally { await client.query('rollback'); client.release(); await pool.end(); }
});
