import { getPool } from '@/db/pool';
import { DRINK_DAY_XP } from '@/lib/drink-calendar-fields';
import { SWIPE_XP } from '@/lib/drink-swipes';
import { getTelegramEnv } from '@/lib/env';
import { WELCOME_CAPS } from '@/lib/gacha-fields';

/** Past this age a member with any XP is no longer a newcomer: an active old-timer who never swiped needs no checklist. */
export const NEWCOMER_DAYS = 30;
/** What the trigger `caps_drink_day` pays for the first can of a day. */
const DRINK_DAY_CAPS = 3;

export interface FirstStep { key: 'gacha' | 'dating' | 'drink' | 'profile' | 'telegram'; title: string; hint: string; href: string; done: boolean; reward: string | null }
export interface FirstStepsState {
  pulled: boolean; swiped: boolean; drank: boolean; profiled: boolean; welcomed: boolean;
  /** Telegram linked and the bot started (not stopped); `null` or absent — the site has no bot, so no step. */
  telegram?: boolean | null;
}

/** A reward is named only when the system pays it: the welcome caps come with the first visit, so they leave once taken. */
export function firstSteps({ pulled, swiped, drank, profiled, welcomed, telegram = null }: FirstStepsState): FirstStep[] {
  return [
    { key: 'gacha', title: 'Взять бесплатную крутку', hint: 'Карточка банки в ваш альбом', href: '/gacha', done: pulled, reward: welcomed ? null : `+${WELCOME_CAPS} крышек` },
    { key: 'dating', title: 'Полистать дейтинг напитков', hint: 'Вправо — нравится, влево — мимо', href: '/community?type=dating', done: swiped, reward: `+${SWIPE_XP} XP за свайп` },
    { key: 'drink', title: 'Отметить или оценить банку', hint: 'С первой банки начнётся серия', href: '/calendar#add-drink', done: drank, reward: `+${DRINK_DAY_CAPS} крышки и ${DRINK_DAY_XP} XP` },
    // Both fields are on this page: the nickname panel, and the avatar in the preview above it.
    { key: 'profile', title: 'Поставить аватарку и ник', hint: 'Чтобы вас узнавали в ленте', href: '/profile/settings?section=details', done: profiled, reward: null },
    // A way to call a newcomer back: reminders about the streak, replies and follows reach them through the bot.
    // Done only when the bot can write: linking alone (through the mini app) does not start the chat.
    ...(telegram === null ? [] : [{ key: 'telegram' as const, title: 'Подключить Telegram-бота', hint: 'Напомним о серии и ответах на ваши отзывы', href: '/profile/settings?section=telegram-bot', done: telegram, reward: null }]),
  ];
}

/**
 * The steps for the home card, or `null` when there is no card: hidden, finished, past being a newcomer or blocked. One
 * query, primary keys and user indexes only (the bot's chats are few). `telegram` — whether the site has a bot.
 */
export async function getFirstSteps(userId: string, { telegram = getTelegramEnv() !== null }: { telegram?: boolean } = {}): Promise<FirstStep[] | null> {
  const { rows } = await getPool().query<FirstStepsState & { show: boolean; bot: boolean }>(`select
      u."firstStepsHiddenAt" is null
        and not exists(select 1 from "userBlock" where "userId" = u.id)
        and (u."createdAt" > now() - make_interval(days => $2) or not exists(select 1 from "profileExperience" where "userId" = u.id)) as show,
      exists(select 1 from "gachaPull" where "userId" = u.id) as pulled,
      exists(select 1 from "drinkSwipe" where "userId" = u.id) as swiped,
      exists(select 1 from "drinkLog" where "userId" = u.id) or exists(select 1 from review where "userId" = u.id) as drank,
      u.username is not null and exists(select 1 from "profileImage" where "userId" = u.id and kind = 'avatar') as profiled,
      exists(select 1 from "capLedger" where "userId" = u.id and reason = 'welcome' and "sourceKey" = 'welcome') as welcomed,
      exists(select 1 from account a join "telegramChat" c on c."telegramId"::text = a."accountId"
        where a."userId" = u.id and a."providerId" = 'telegram' and c."blockedAt" is null) as bot
    from "user" u where u.id = $1`, [userId, NEWCOMER_DAYS]);
  const row = rows[0];
  if (!row?.show) return null;
  const steps = firstSteps({ ...row, telegram: telegram ? row.bot : null });
  return steps.every(step => step.done) ? null : steps;
}

export async function hideFirstSteps(userId: string): Promise<void> {
  await getPool().query(`update "user" set "firstStepsHiddenAt" = now() where id = $1 and "firstStepsHiddenAt" is null`, [userId]);
}
