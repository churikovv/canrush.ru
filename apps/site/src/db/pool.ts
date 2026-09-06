import { Pool } from 'pg';
import { getAuthEnv } from '@/lib/env';

const globalForDatabase = globalThis as typeof globalThis & {
  canrushDatabasePool?: Pool;
};

function createPool(): Pool {
  return new Pool({
    application_name: 'canrush-site',
    connectionString: getAuthEnv().databaseUrl,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    max: process.env.NODE_ENV === 'production' ? 5 : 3,
    statement_timeout: 10_000,
    allowExitOnIdle: process.env.NODE_ENV === 'test',
  });
}

export function getPool(): Pool {
  const existing = globalForDatabase.canrushDatabasePool;
  if (existing) return existing;

  const databasePool = createPool();
  if (process.env.NODE_ENV !== 'production') globalForDatabase.canrushDatabasePool = databasePool;
  return databasePool;
}
