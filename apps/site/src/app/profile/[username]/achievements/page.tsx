import '@/styles/shared.css';
import '@/styles/trophies.css';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { TrophyRoom, type TrophyCard } from '@/components/trophy-room';
import { ACHIEVEMENT_TITLES, ACHIEVEMENT_XP, achievementSummary, isScored, TROPHY_POINTS } from '@/lib/achievement-summary';
import { isSiteAdminEmail } from '@/lib/admin';
import { auth } from '@/lib/auth';
import { getBadges } from '@/lib/badge-progress';
import { MARKET_OPEN } from '@/lib/market-open';
import { BADGE_ACHIEVEMENTS } from '@/lib/badges';
import { getProfileByUsername } from '@/lib/profile';
import { achievementCompletion, tierCount, tierSteps, visibleProfileAchievements, type ProfileAchievement } from '@/lib/profile-achievements';
import { getAchievementDates, getProfileCommunity } from '@/lib/profile-community';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Достижения', robots: { index: false, follow: false } };

/**
 * Role tags, the giveaway's tag and the beta number cannot be worked towards: they only appear once held. So does
 * «Селлер» while the market is closed (`MARKET_OPEN`).
 */
const ONLY_WHEN_HELD = new Set(['admin', 'moderator', 'energizer', 'engine', ...(MARKET_OPEN ? [] : ['seller'])]);

/**
 * Achievements as a game screen (`TrophyRoom`), like the season pass and the card inventory. Tags and the achievements
 * that are only achievements (`lib/badges.ts`) share it: one trophy score, one collector title, one strip of medals.
 * Viewing the page earns what is due, as the profile does for tags.
 */
export default async function AchievementsPage({ params }: { params: Promise<{ username: string }> }) {
  const [{ username }, session] = await Promise.all([params, auth.api.getSession({ headers: await headers() })]);
  const profile = await getProfileByUsername(username);
  if (!profile) notFound();
  const own = session?.user.id === profile.id;
  const admin = session ? await isSiteAdminEmail(session.user.email) : false;
  const [community, tagDates, badges] = await Promise.all([getProfileCommunity(profile.id, session?.user.id), getAchievementDates(profile.id, 200), getBadges(profile.id)]);
  const dates = new Map([...tagDates, ...badges.earned].map(row => [row.key, row.earnedAt]));
  const badgeKeys = new Set(badges.earned.map(row => row.key));

  function card<M extends string>(item: ProfileAchievement<M>, progress: Record<M, number>, earned: boolean, tag: boolean): TrophyCard {
    const scored = isScored(item.key);
    const tiers = tierCount(item);
    const tier = earned ? Math.min(tiers, (tag ? community.tiers[item.key] : undefined) ?? 1) : 0;
    // What is left: tier I while locked, then the next tier, nothing once the top one is reached.
    const steps = tier >= tiers ? [] : tierSteps(item, tier + 1);
    return {
      key: item.key, label: item.label, rarity: item.rarity, description: item.description,
      earned, earnedAt: dates.get(item.key)?.toISOString() ?? null, tag, tier, tiers,
      points: scored ? TROPHY_POINTS[item.rarity] : 0, xp: tag && scored ? ACHIEVEMENT_XP : 0,
      completion: earned ? 1 : achievementCompletion(item, progress),
      steps: steps.map(step => ({ label: step.label, value: progress[step.metric] ?? 0, goal: step.goal })),
    };
  }
  const tags = visibleProfileAchievements(admin, community.earned)
    .filter(item => community.earned.includes(item.key) || (!ONLY_WHEN_HELD.has(item.key) && isScored(item.key)))
    .map(item => card(item, community.progress, community.earned.includes(item.key), true));
  const others = BADGE_ACHIEVEMENTS.map(item => card(item, badges.progress, badgeKeys.has(item.key), false));
  // Earned first, newest on top; then what is closest to done, the bigger prize first among equals.
  const cards = [...tags, ...others].sort((a, b) => Number(b.earned) - Number(a.earned)
    || (a.earned ? (b.earnedAt ?? '').localeCompare(a.earnedAt ?? '') : b.completion - a.completion || b.points - a.points)
    || a.label.localeCompare(b.label, 'ru'));

  // The score counts what any member can see, so an admin's view of secret tags does not change it.
  const summary = achievementSummary([...visibleProfileAchievements(false, community.earned), ...BADGE_ACHIEVEMENTS] as ProfileAchievement<string>[],
    [...community.earned, ...badgeKeys], { ...community.progress, ...badges.progress } as Record<string, number>, [...tagDates, ...badges.earned], community.tiers);

  return <TrophyRoom cards={cards} score={summary.score} isOwn={own} owner={`@${profile.username}`} backHref={own ? '/profile' : `/profile/${profile.username}`} worn={community.tags[0] ?? null}
    title={{ label: summary.title.label, index: summary.title.index, score: summary.title.score, next: summary.next, titles: ACHIEVEMENT_TITLES.length }} />;
}
