import { getExperience } from '@/lib/profile-experience';
export async function GET(request: Request) {
  const usernames = [...new Set(new URL(request.url).searchParams.get('users')?.split(',') ?? [])];
  if (!usernames.length || usernames.length > 50 || usernames.some(name => !/^[a-zA-Z0-9_]{3,24}$/.test(name))) return Response.json({}, { status: 400 });
  return Response.json(await getExperience(usernames), { headers: { 'Cache-Control': 'no-store' } });
}
