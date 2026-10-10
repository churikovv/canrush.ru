import { DEFAULT_PROFILE_APPEARANCE, parseProfileAppearance, type ProfileAppearance } from '@/lib/profile-appearance';
import { DEFAULT_PROFILE_LAYOUT, parseProfileLayout, type ProfileLayout } from '@/lib/profile-layout';
import type { QueryResultRow } from 'pg';
import { getPool } from '@/db/pool';
import { isReservedUsername, normalizeUsername } from '@/lib/profile-fields';

interface ProfileRow extends QueryResultRow {
  id: string;
  username: string | null;
  name: string;
  email: string;
  createdAt: Date;
  telegramChannel: string | null;
  favoriteCount: number;
  reviewCount: number;
  tierListCount: number;
  avatarId: string | null;
  bannerId: string | null;
  profileLayout?: ProfileLayout;
  profileAppearance?: ProfileAppearance;
}

export interface ProfileData {
  id: string;
  username: string;
  name: string;
  email: string;
  createdAt: Date;
  telegramChannel: string | null;
  favoriteCount: number;
  reviewCount: number;
  tierListCount: number;
  avatarId: string | null;
  bannerId: string | null;
  profileLayout?: ProfileLayout;
  profileAppearance?: ProfileAppearance;
}

const PROFILE_SELECT = `
  select
    u."id",
    u."username",
    u."name",
    u."email",
    u."createdAt",
    u."telegramChannel",
    u."profileLayout",
    u."profileAppearance",
    (select id::text from "profileImage" where "userId" = u.id and kind = 'avatar') as "avatarId",
    (select id::text from "profileImage" where "userId" = u.id and kind = 'banner') as "bannerId",
    coalesce((select count(*)::int from "favorite" f where f."userId" = u."id"), 0) as "favoriteCount",
    coalesce((select count(*)::int from "review" r where r."userId" = u."id"), 0) as "reviewCount",
    coalesce((select count(*)::int from "tierList" tl where tl."userId" = u."id" and tl."status" = 'published'), 0) as "tierListCount"
  from "user" u
`;

function toProfile(row: ProfileRow): ProfileData | null {
  if (!row.username) return null;
  return {
    profileAppearance: parseProfileAppearance(row.profileAppearance) ?? DEFAULT_PROFILE_APPEARANCE,
    profileLayout: parseProfileLayout(row.profileLayout) ?? DEFAULT_PROFILE_LAYOUT,
    id: row.id,
    username: row.username,
    name: row.name,
    email: row.email,
    createdAt: row.createdAt,
    telegramChannel: row.telegramChannel,
    avatarId: row.avatarId,
    bannerId: row.bannerId,
    favoriteCount: Number(row.favoriteCount),
    reviewCount: Number(row.reviewCount),
    tierListCount: Number(row.tierListCount),
  };
}

function defaultUsername(email: string): string {
  const local = email.split('@')[0] ?? '';
  const normalized = local
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9_]+/gu, '_')
    .replace(/^_+|_+$/gu, '')
    .slice(0, 24);
  return normalized.length >= 3 && !isReservedUsername(normalized) ? normalized : 'user';
}

function pgErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object' || !('code' in error)) return undefined;
  return typeof error.code === 'string' ? error.code : undefined;
}

async function claimDefaultUsername(userId: string, email: string): Promise<void> {
  const base = defaultUsername(email);
  const suffix = userId.replace(/[^a-z0-9]/giu, '').slice(0, 6).toLocaleLowerCase('en-US') || 'member';
  const candidates = [base, `${base.slice(0, Math.max(3, 17 - suffix.length))}_${suffix}`, `user_${suffix}`];

  for (const candidate of candidates) {
    try {
      const updated = await getPool().query(
        `update "user" set "username" = $2, "updatedAt" = now()
         where "id" = $1 and "username" is null`,
        [userId, candidate],
      );
      if (updated.rowCount === 1) return;

      const existing = await getPool().query<{ username: string | null }>(
        'select "username" from "user" where "id" = $1',
        [userId],
      );
      if (existing.rows[0]?.username) return;
    } catch (error) {
      if (pgErrorCode(error) !== '23505') throw error;
    }
  }

  throw new Error('Не удалось создать уникальный юзернейм');
}

export async function getProfileByUserId(userId: string): Promise<ProfileData | null> {
  const result = await getPool().query<ProfileRow>(`${PROFILE_SELECT} where u."id" = $1 limit 1`, [userId]);
  const row = result.rows[0];
  return row ? toProfile(row) : null;
}

export async function ensureOwnProfile(user: { id: string; email: string }): Promise<ProfileData> {
  let profile = await getProfileByUserId(user.id);
  if (profile) return profile;

  await claimDefaultUsername(user.id, user.email);
  profile = await getProfileByUserId(user.id);
  if (!profile) throw new Error('Профиль не найден');
  return profile;
}

export async function getProfileByUsername(username: string): Promise<ProfileData | null> {
  const normalized = normalizeUsername(username);
  if (!/^[a-z0-9_]{3,24}$/u.test(normalized)) return null;

  const result = await getPool().query<ProfileRow>(
    `${PROFILE_SELECT} where lower(u."username") = $1 limit 1`,
    [normalized],
  );
  const row = result.rows[0];
  return row ? toProfile(row) : null;
}

export function isUniqueViolation(error: unknown): boolean {
  return pgErrorCode(error) === '23505';
}
