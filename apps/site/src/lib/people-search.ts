import { getPool } from '@/db/pool';
import { parseProfileAppearance, DEFAULT_PROFILE_APPEARANCE, type ProfileAppearance } from '@/lib/profile-appearance';

export interface PersonResult {
  username: string; name: string; bio: string | null; xp: number; rank: number; avatarId: string | null;
  frame: ProfileAppearance['frame'];
  /** The member's chosen tag, only if still earned (as on the wall). */
  tag: string | null;
  /** Personal «Двигатель беты» number, shown on that tag. */
  engineNumber: number | null;
  followers: number; cans: number;
}

/** Members by username, name or description, exact username first, then by experience; without a query, the top of the ranking. Blocked members are not in "profileRanking". */
export async function searchPeople(query: string, limit = 50): Promise<PersonResult[]> {
  const text = query.trim().replace(/^@/, '');
  const { rows } = await getPool().query<Omit<PersonResult, 'frame'> & { appearance: unknown }>(`select r.username, r.name, u.bio, r.xp, r.rank,
      (select id::text from "profileImage" where "userId" = r.id and kind = 'avatar') as "avatarId",
      u."profileAppearance" as appearance,
      case when u."profileTags"[1] = 'admin' then case when exists(select 1 from "siteAdmin" where email = lower(u.email)) then 'admin' end
        when exists(select 1 from "profileAchievement" where "userId" = u.id and key = u."profileTags"[1]) then u."profileTags"[1] end as tag,
      (select number from "betaEngine" where "userId" = u.id) as "engineNumber",
      (select count(*)::int from "userFollow" where "targetId" = u.id) as followers,
      (select count(*)::int from "drinkLog" where "userId" = u.id) as cans
    from "profileRanking" r join "user" u on u.id = r.id
    where $1 = '' or strpos(lower(r.username), lower($1)) > 0 or strpos(lower(r.name), lower($1)) > 0 or strpos(lower(coalesce(u.bio, '')), lower($1)) > 0
    order by (lower(r.username) = lower($1)) desc, r.xp desc, r.username limit $2`, [text, limit]);
  return rows.map(({ appearance, ...row }) => ({ ...row, frame: (parseProfileAppearance(appearance) ?? DEFAULT_PROFILE_APPEARANCE).frame }));
}
