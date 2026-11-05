import { getPool } from '@/db/pool';
import { experienceLevel } from '@/lib/experience-level';
import { DEFAULT_PROFILE_APPEARANCE, parseProfileAppearance, type ProfileAppearance } from '@/lib/profile-appearance';
import { rankTasteMatches } from '@/lib/taste-card';
import { drinkCatalog } from '@/lib/wall-drinks';

/**
 * Люди в колоде дейтинга: карточка участника между карточками напитков, свайп вправо — подписаться, влево — пропустить.
 * Подписки сильнее всего связаны с тем, что человек вернётся (исследование удержания, ноябрь 2026: 79% против 31%),
 * поэтому новичку карточка приходит раньше. Сначала похожий вкус (как у «Тебе понравится»), а пока у новичка мало
 * решений для сходства — активные участники. Кого пропустили, того не предлагаем `SKIP_DAYS` дней.
 */
export const SKIP_DAYS = 30;
/** After how many drink swipes in one visit a person card comes: a newcomer sooner, everyone else after 20. */
export const PEOPLE_AT = { newcomer: [6, 16, 26], member: [20] } as const;

export type PersonReason = { kind: 'taste'; shared: number; drinks: { label: string; cover?: string }[] } | { kind: 'active' };
/** A person as their profile shows them: banner, framed avatar, level, tag and description, and why they are offered. */
export interface PersonSuggestion {
  id: string; username: string; name: string; avatarId: string | null; bannerId: string | null;
  frame: ProfileAppearance['frame']; level: number; bio: string | null;
  /** The chosen tag while still theirs (earned, bought in the shop, or a role they still hold), as on the wall. */
  tag: string | null; verified: boolean; reviews: number; followers: number;
  reason: PersonReason;
}
type PersonRow = Omit<PersonSuggestion, 'reason' | 'frame' | 'level'> & { appearance: unknown; xp: number; lastSeenAt: Date | null };
// `lastSeenAt` only orders the active members: a member can hide being online, so it never reaches the page.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const person = ({ appearance, xp, lastSeenAt, ...row }: PersonRow): Omit<PersonSuggestion, 'reason'> => ({
  ...row, frame: (parseProfileAppearance(appearance) ?? DEFAULT_PROFILE_APPEARANCE).frame, level: experienceLevel(xp).level,
});

/** Who can be offered: a nickname, no site block, no block either way, not followed, not skipped lately, not shown now. */
const ALLOWED = `u.id <> $1 and u.username is not null and u.id <> all($2::text[])
  and not exists(select 1 from "userBlock" b where b."userId" = u.id)
  and not exists(select 1 from "memberBlock" m where (m."blockerId" = $1 and m."blockedId" = u.id) or (m."blockerId" = u.id and m."blockedId" = $1))
  and not exists(select 1 from "userFollow" f where f."userId" = $1 and f."targetId" = u.id)
  and not exists(select 1 from "followSuggestionSkip" s where s."userId" = $1 and s."targetId" = u.id and s."createdAt" > now() - make_interval(days => ${SKIP_DAYS}))`;
const PERSON = `u.id, u.username, u.name, u.bio, u."lastSeenAt", u."profileAppearance" as appearance, u."verifiedAt" is not null as verified,
  (select p.id::text from "profileImage" p where p."userId" = u.id and p.kind = 'avatar') as "avatarId",
  (select p.id::text from "profileImage" p where p."userId" = u.id and p.kind = 'banner') as "bannerId",
  case when u."profileTags"[1] in ('admin', 'moderator') then case when exists(select 1 from "siteAdmin" a where a.email = lower(u.email) and a.role = u."profileTags"[1]) then u."profileTags"[1] end
    when exists(select 1 from "profileAchievement" a where a."userId" = u.id and a.key = u."profileTags"[1])
      or exists(select 1 from "shopPurchase" b where b."userId" = u.id and b.key = u."profileTags"[1]) then u."profileTags"[1] end as tag,
  coalesce((select sum(points) from "profileExperience" e where e."userId" = u.id), 0)::int as xp,
  (select count(*) from review r where r."userId" = u.id)::int as reviews,
  (select count(*) from "userFollow" f where f."targetId" = u.id)::int as followers`;

export async function getPeopleSuggestions(userId: string, limit = 1, exclude: readonly string[] = []): Promise<PersonSuggestion[]> {
  const db = getPool();
  const ranked = await rankTasteMatches(userId).catch(() => []);
  const people: PersonSuggestion[] = [];
  if (ranked.length) {
    const { rows } = await db.query<PersonRow>(`select ${PERSON} from "user" u where u.id = any($3::text[]) and ${ALLOWED}`,
      [userId, [...exclude], ranked.map(item => item.id)]);
    const allowed = new Map(rows.map(row => [row.id, person(row)]));
    const catalog = await drinkCatalog();
    for (const item of ranked) {
      const found = allowed.get(item.id);
      if (!found) continue;
      const drinks = item.shared.flatMap(drink => { const option = catalog.get(JSON.stringify([drink.brand, drink.flavor])); return option ? [{ label: option.label, ...(option.cover ? { cover: option.cover } : {}) }] : []; }).slice(0, 3);
      people.push({ ...found, reason: { kind: 'taste', shared: item.shared.length, drinks } });
      if (people.length >= limit) return people;
    }
  }
  // Not enough taste in common yet (a newcomer's first swipes): people who are active now and write reviews.
  const { rows } = await db.query<PersonRow>(`select * from (select ${PERSON} from "user" u
      where ${ALLOWED} and u.id <> all($3::text[]) and u."showOnline" is not false and u."lastSeenAt" > now() - interval '14 days') x
    order by reviews + followers desc, "lastSeenAt" desc limit $4`, [userId, [...exclude], people.map(item => item.id), limit - people.length]);
  return [...people, ...rows.map(row => ({ ...person(row), reason: { kind: 'active' as const } }))];
}

/** Left on a person card: not offered again for `SKIP_DAYS` days. */
export async function skipPerson(userId: string, targetId: string): Promise<void> {
  await getPool().query(`insert into "followSuggestionSkip"("userId", "targetId") select $1, id from "user" where id = $2 and id <> $1
    on conflict ("userId", "targetId") do update set "createdAt" = now()`, [userId, targetId]);
}
export async function unskipPerson(userId: string, targetId: string): Promise<void> {
  await getPool().query('delete from "followSuggestionSkip" where "userId" = $1 and "targetId" = $2', [userId, targetId]);
}

/** The schedule of person cards for this member: a newcomer (30 days, or no XP yet — as «Первые шаги») gets them sooner. */
export async function peopleSchedule(userId: string): Promise<readonly number[]> {
  const { rows } = await getPool().query<{ newcomer: boolean }>(`select u."createdAt" > now() - interval '30 days'
      or not exists(select 1 from "profileExperience" e where e."userId" = u.id) as newcomer from "user" u where u.id = $1`, [userId]);
  return rows[0]?.newcomer ? PEOPLE_AT.newcomer : PEOPLE_AT.member;
}
