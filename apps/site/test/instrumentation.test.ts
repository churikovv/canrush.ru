import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const recordServerError = vi.fn(async () => undefined);
vi.mock('@/lib/error-log', () => ({ recordServerError }));
const { onRequestError } = await import('../src/instrumentation');

const call = () => onRequestError(new Error('boom'), { path: '/catalog/burn?x=1', method: 'GET', headers: { cookie: 'session=secret' } }, { routerKind: 'App Router', routePath: '/catalog/[slug]', routeType: 'render', renderSource: 'react-server-components', revalidateReason: undefined });

beforeEach(() => { recordServerError.mockClear(); vi.stubEnv('NEXT_RUNTIME', 'nodejs'); });
afterEach(() => vi.unstubAllEnvs());

it('records in production and passes only the path and the route', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  await call();
  expect(recordServerError).toHaveBeenCalledWith(expect.any(Error), '/catalog/burn?x=1', '/catalog/[slug]');
});

it('stays quiet in development unless asked, and with ERROR_LOG=off', async () => {
  vi.stubEnv('NODE_ENV', 'development');
  await call();
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('ERROR_LOG', 'off');
  await call();
  expect(recordServerError).not.toHaveBeenCalled();
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('ERROR_LOG', 'on');
  await call();
  expect(recordServerError).toHaveBeenCalledTimes(1);
});
