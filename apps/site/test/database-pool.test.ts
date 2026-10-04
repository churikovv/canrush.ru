import { afterEach, expect, it, vi } from 'vitest';
const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('pg', () => ({ Pool: class { constructor(options: unknown) { create(options); } } }));
vi.mock('../src/lib/env', () => ({ getAuthEnv: () => ({ databaseUrl: 'postgresql://localhost/canrush_site_test' }) }));
afterEach(() => {
  delete (globalThis as typeof globalThis & { canrushDatabasePool?: unknown }).canrushDatabasePool;
  vi.unstubAllEnvs();
  vi.resetModules();
  create.mockClear();
});
it('reuses one bounded pool across production requests and module reloads', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  const { getPool } = await import('../src/db/pool');
  const pool = getPool();
  for (let i = 0; i < 100; i++) expect(getPool()).toBe(pool);
  vi.resetModules();
  expect((await import('../src/db/pool')).getPool()).toBe(pool);
  expect(create).toHaveBeenCalledTimes(1);
  expect(create).toHaveBeenCalledWith(expect.objectContaining({ max: 5, connectionTimeoutMillis: 5000 }));
});
