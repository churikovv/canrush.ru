/**
 * Universal Links: proves to iOS that canrush.ru belongs to the app ru.canrush.app (apps/ios, entitlement
 * applinks:canrush.ru), so site links — the sign-in letter included — open in the app. APPLE_TEAM_ID is the Team ID from
 * developer.apple.com → Membership (comma-separated for several teams); without it the file is not served (404).
 * API routes, Next assets and the admin panel stay in Safari. Apple's CDN fetches it once and caches it: answer 200
 * with JSON and no redirect.
 */
const BUNDLE_ID = 'ru.canrush.app';
const TEAM_ID = /^[A-Z0-9]{10}$/u;

export function GET() {
  const teams = (process.env.APPLE_TEAM_ID ?? '').split(',').map(value => value.trim().toUpperCase()).filter(value => TEAM_ID.test(value));
  if (!teams.length) return new Response(null, { status: 404 });
  return Response.json({
    applinks: {
      details: [{
        appIDs: teams.map(team => `${team}.${BUNDLE_ID}`),
        components: [
          { '/': '/api/*', exclude: true },
          { '/': '/_next/*', exclude: true },
          { '/': '/admin*', exclude: true },
          { '/': '/*' },
        ],
      }],
    },
  }, { headers: { 'cache-control': 'public, max-age=3600' } });
}
