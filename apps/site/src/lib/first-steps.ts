import { getPool } from '@/db/pool';
import { WELCOME_CAPS } from '@/lib/gacha-fields';
import { getPeopleSuggestions, type PersonSuggestion } from '@/lib/people-suggestions';
import { PROFILE_ACHIEVEMENTS } from '@/lib/profile-achievements';
import { PROFILE_FRAMES } from '@/lib/profile-appearance';

/** Past this age a member with any XP is no longer a newcomer: an active old-timer who never swiped needs no card. */
export const NEWCOMER_DAYS = 30;
/** Swipes in the drink dating deck that open «Первый заряд». */
export const FIRST_SWIPES = 5;
/** The rewards: a tag for the swipes, an animated frame for the first follow. Kept in `firstStepReward` (0197). */
export const FIRST_STEP_TAG = 'first-charge';
export const FIRST_STEP_FRAME = 'charge';
const TAG_LABEL = PROFILE_ACHIEVEMENTS.find(item => item.key === FIRST_STEP_TAG)?.label ?? 'Первый заряд';
const FRAME_LABEL = PROFILE_FRAMES.find(item => item.key === FIRST_STEP_FRAME)?.label ?? 'Заряд';

export type FirstStepKey = 'gacha' | 'swipes' | 'follow';
/** A step with a reward to take by button; the free pull pays by itself (the welcome caps come with the first visit). */
export type ClaimStep = Extract<FirstStepKey, 'swipes' | 'follow'>;
export type FirstStepReward =
  | { kind: 'caps'; caps: number }
  | { kind: 'card' }
  | { kind: 'tag'; key: typeof FIRST_STEP_TAG; label: string }
  | { kind: 'frame'; key: typeof FIRST_STEP_FRAME; label: string };
export interface FirstStep {
  key: FirstStepKey; title: string; hint: string; href: string; action: string; done: boolean;
  progress: { value: number; goal: number } | null;
  reward: FirstStepReward;
  /** Done, but the reward still waits for its button. Always false for the pull. */
  claimable: boolean;
}
export interface FirstStepsState { pulled: boolean; welcomed: boolean; swipes: number; followed: boolean; claimedTag: boolean; claimedFrame: boolean }
export interface FirstStepsCard {
  steps: FirstStep[];
  /** Someone to follow right on the card while the follow step waits, so it takes one tap. */
  person: PersonSuggestion | null;
  /** For the frame's reveal: the member's own avatar. */
  avatarId: string | null; username: string | null;
}

/** Three short steps; the rewards are named only when the system pays them. */
export function firstSteps({ pulled, welcomed, swipes, followed, claimedTag, claimedFrame }: FirstStepsState): FirstStep[] {
  const swiped = swipes >= FIRST_SWIPES;
  return [
    { key: 'gacha', title: 'Крутка', hint: 'Карточка банки в ваш альбом', href: '/gacha', action: 'Крутить бесплатно', done: pulled, progress: null,
      reward: welcomed ? { kind: 'card' } : { kind: 'caps', caps: WELCOME_CAPS }, claimable: false },
    { key: 'swipes', title: `${FIRST_SWIPES} свайпов`, hint: 'Дейтинг напитков: вправо — нравится', href: '/community?type=dating', action: 'Листать дейтинг',
      done: swiped, progress: { value: Math.min(swipes, FIRST_SWIPES), goal: FIRST_SWIPES }, reward: { kind: 'tag', key: FIRST_STEP_TAG, label: TAG_LABEL }, claimable: swiped && !claimedTag },
    { key: 'follow', title: 'Подписка', hint: 'На участника с похожим вкусом', href: '/community?type=people', action: 'Найти людей',
      done: followed, progress: null, reward: { kind: 'frame', key: FIRST_STEP_FRAME, label: FRAME_LABEL }, claimable: followed && !claimedFrame },
  ];
}

/** Who gets the card: not hidden, not blocked by the site, a newcomer (or without any XP yet). */
const CARD_FOR = `u."firstStepsHiddenAt" is null
  and not exists(select 1 from "userBlock" where "userId" = u.id)
  and (u."createdAt" > now() - make_interval(days => $2) or not exists(select 1 from "profileExperience" where "userId" = u.id))`;
const STATE = `exists(select 1 from "gachaPull" where "userId" = u.id) as pulled,
  exists(select 1 from "capLedger" where "userId" = u.id and reason = 'welcome' and "sourceKey" = 'welcome') as welcomed,
  (select count(*)::int from "drinkSwipe" where "userId" = u.id) as swipes,
  exists(select 1 from "userFollow" where "userId" = u.id) as followed,
  exists(select 1 from "firstStepReward" where "userId" = u.id and step = 'swipes') as "claimedTag",
  exists(select 1 from "firstStepReward" where "userId" = u.id and step = 'follow') as "claimedFrame"`;

/**
 * The home card, or `null` when there is none: hidden, past being a newcomer, blocked, or every step done and every
 * reward taken. One query on primary keys and user indexes; a person to follow is picked only while that step waits.
 */
export async function getFirstSteps(userId: string): Promise<FirstStepsCard | null> {
  const { rows } = await getPool().query<FirstStepsState & { show: boolean; avatarId: string | null; username: string | null }>(`select ${CARD_FOR} as show, ${STATE},
      u.username, (select id from "profileImage" where "userId" = u.id and kind = 'avatar') as "avatarId"
    from "user" u where u.id = $1`, [userId, NEWCOMER_DAYS]);
  const row = rows[0];
  if (!row?.show) return null;
  const steps = firstSteps(row);
  if (steps.every(step => step.done && !step.claimable)) return null;
  const person = row.followed ? null : (await getPeopleSuggestions(userId, 1).catch(() => []))[0] ?? null;
  return { steps, person, avatarId: row.avatarId, username: row.username };
}

export type ClaimResult = { ok: true; equipped: boolean } | { ok: false; error: string };

/**
 * Takes a step's reward: checks the step itself under a lock of the member, writes `firstStepReward` once, gives the tag
 * (its XP comes from the achievement trigger) and puts the reward on when its slot is empty. Taking it twice is harmless.
 */
export async function claimFirstStep(userId: string, step: ClaimStep): Promise<ClaimResult> {
  const client = await getPool().connect();
  try {
    await client.query('begin');
    const { rows } = await client.query<FirstStepsState & { show: boolean }>(`select ${CARD_FOR} as show, ${STATE} from "user" u where u.id = $1 for update`, [userId, NEWCOMER_DAYS]);
    const row = rows[0];
    if (!row?.show) { await client.query('rollback'); return { ok: false, error: 'Награды первых шагов — для новичков. Загляните в достижения профиля.' }; }
    const done = step === 'swipes' ? row.swipes >= FIRST_SWIPES : row.followed;
    if (!done) { await client.query('rollback'); return { ok: false, error: step === 'swipes' ? `Сначала сделайте ${FIRST_SWIPES} свайпов в дейтинге напитков.` : 'Сначала подпишитесь на участника.' }; }
    await client.query('insert into "firstStepReward" ("userId", step) values ($1, $2) on conflict do nothing', [userId, step]);
    let equipped: boolean;
    if (step === 'swipes') {
      await client.query('insert into "profileAchievement" ("userId", key) values ($1, $2) on conflict do nothing', [userId, FIRST_STEP_TAG]);
      await client.query(`update "user" set "profileTags" = array[$2::text] where id = $1 and cardinality("profileTags") = 0`, [userId, FIRST_STEP_TAG]);
      equipped = (await client.query<{ on: boolean }>(`select "profileTags"[1] = $2 as on from "user" where id = $1`, [userId, FIRST_STEP_TAG])).rows[0]?.on ?? false;
    } else {
      await client.query(`update "user" set "profileAppearance" = jsonb_set("profileAppearance", '{frame}', to_jsonb($2::text)) where id = $1 and "profileAppearance"->>'frame' = 'none'`, [userId, FIRST_STEP_FRAME]);
      equipped = (await client.query<{ on: boolean }>(`select "profileAppearance"->>'frame' = $2 as on from "user" where id = $1`, [userId, FIRST_STEP_FRAME])).rows[0]?.on ?? false;
    }
    await client.query('commit');
    return { ok: true, equipped };
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** «Надеть» on the reveal when the slot was taken: a member wears one tag and one frame, so both replace the current ones. */
export async function wearFirstStepReward(userId: string, step: ClaimStep): Promise<boolean> {
  const { rowCount } = step === 'swipes'
    ? await getPool().query(`update "user" set "profileTags" = array[$2::text]
        where id = $1 and exists(select 1 from "firstStepReward" where "userId" = $1 and step = 'swipes')`, [userId, FIRST_STEP_TAG])
    : await getPool().query(`update "user" set "profileAppearance" = jsonb_set("profileAppearance", '{frame}', to_jsonb($2::text))
        where id = $1 and exists(select 1 from "firstStepReward" where "userId" = $1 and step = 'follow')`, [userId, FIRST_STEP_FRAME]);
  return (rowCount ?? 0) > 0;
}

export async function hideFirstSteps(userId: string): Promise<void> {
  await getPool().query(`update "user" set "firstStepsHiddenAt" = now() where id = $1 and "firstStepsHiddenAt" is null`, [userId]);
}
