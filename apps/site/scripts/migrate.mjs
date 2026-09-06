import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import pg from 'pg';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(currentDirectory, '../.env.local'), quiet: true });

const { Pool } = pg;
const planOnly = process.argv.includes('--plan');
const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) throw new Error('DATABASE_URL is required');

const migrationsDirectory = resolve(currentDirectory, '../migrations');
const migrationFiles = (await readdir(migrationsDirectory))
  .filter((file) => /^\d+.*\.sql$/.test(file))
  .sort();
const migrations = await Promise.all(
  migrationFiles.map(async (file) => {
    const sql = await readFile(resolve(migrationsDirectory, file), 'utf8');
    return {
      checksum: createHash('sha256').update(sql).digest('hex'),
      file,
      sql,
    };
  }),
);

const pool = new Pool({ connectionString, max: 1, allowExitOnIdle: true });
const client = await pool.connect();

try {
  const tableResult = await client.query(`select to_regclass('"_canrush_migrations"')::text as exists`);
  const tableExists = Boolean(tableResult.rows[0]?.exists);
  const applied = new Map();

  if (tableExists) {
    const result = await client.query('select "version", "checksum" from "_canrush_migrations"');
    for (const row of result.rows) applied.set(String(row.version), String(row.checksum));
  }

  for (const migration of migrations) {
    const checksum = applied.get(migration.file);
    if (checksum && checksum !== migration.checksum) {
      throw new Error(`Applied migration was modified: ${migration.file}`);
    }
  }

  const pending = migrations.filter((migration) => !applied.has(migration.file));
  if (planOnly) {
    if (pending.length === 0) console.log('Database schema is up to date.');
    for (const migration of pending) console.log(`Pending: ${migration.file}`);
  } else {
    await client.query(`
      create table if not exists "_canrush_migrations" (
        "version" text primary key,
        "checksum" text not null,
        "appliedAt" timestamptz default current_timestamp not null
      )
    `);

    for (const migration of pending) {
      await client.query('begin');
      try {
        await client.query(migration.sql);
        await client.query(
          'insert into "_canrush_migrations" ("version", "checksum") values ($1, $2)',
          [migration.file, migration.checksum],
        );
        await client.query('commit');
        console.log(`Applied: ${migration.file}`);
      } catch (error) {
        await client.query('rollback');
        throw error;
      }
    }

    if (pending.length === 0) console.log('Database schema is up to date.');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Migration failed');
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
