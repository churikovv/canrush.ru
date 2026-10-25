import { afterEach, expect, it } from 'vitest';
import { GET } from '../src/app/.well-known/apple-app-site-association/route';

afterEach(() => { delete process.env.APPLE_TEAM_ID; });

it('is not served until the Team ID is set', () => {
  expect(GET().status).toBe(404);
  process.env.APPLE_TEAM_ID = 'not-a-team';
  expect(GET().status).toBe(404);
});

it('links the whole site to ru.canrush.app except API, assets and the admin panel', async () => {
  process.env.APPLE_TEAM_ID = 'ab12cd34ef, ZZ99YY88XX';
  const response = GET();
  expect(response.status).toBe(200);
  const body = await response.json() as { applinks: { details: { appIDs: string[]; components: { '/': string; exclude?: boolean }[] }[] } };
  expect(body.applinks.details[0]!.appIDs).toEqual(['AB12CD34EF.ru.canrush.app', 'ZZ99YY88XX.ru.canrush.app']);
  expect(body.applinks.details[0]!.components.filter(item => item.exclude).map(item => item['/'])).toEqual(['/api/*', '/_next/*', '/admin*']);
  expect(body.applinks.details[0]!.components.at(-1)).toEqual({ '/': '/*' });
});
