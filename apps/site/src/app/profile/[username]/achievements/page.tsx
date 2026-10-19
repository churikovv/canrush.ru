import '@/styles/shared.css';
import '@/styles/profile.css';
import Image from 'next/image';
import { achievementImage } from '@/lib/profile-achievements';
import { ProfileBackButton } from '@/components/profile-back-button';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { isSiteAdminEmail } from '@/lib/admin';
import { getProfileByUsername } from '@/lib/profile';
import { getProfileCommunity } from '@/lib/profile-community';
import { ACHIEVEMENT_RARITIES, achievementCompletion, visibleProfileAchievements } from '@/lib/profile-achievements';
import { AchievementSteps } from '@/components/achievement-steps';
import { BrandShell } from '@/components/brand-shell';
import { ProfileNavigation } from '@/components/profile-navigation';
export const metadata = { title: 'Достижения', robots: { index: false, follow: false } };
export default async function AchievementsPage({ params }: { params: Promise<{ username: string }> }) {
  const profile = await getProfileByUsername((await params).username);
  if (!profile) notFound();
  const session = await auth.api.getSession({ headers: await headers() });
  const admin = session ? await isSiteAdminEmail(session.user.email) : false;
  const community = await getProfileCommunity(profile.id, session?.user.id);
  const visible = visibleProfileAchievements(admin, community.earned);
  const earned = visible.filter(item => community.earned.includes(item.key));
  // "admin" and the giveaway tag cannot be worked towards, so they only appear once held.
  const locked = visible.filter(item => item.key !== 'admin' && item.key !== 'energizer' && !community.earned.includes(item.key))
    .map(item => ({ item, completion: achievementCompletion(item, community.progress) }))
    .sort((a, b) => b.completion - a.completion);
  return <BrandShell headerAction={<ProfileNavigation active="profile" />} surfaceClassName="profile-surface">
    <section className="community-directory profile-achievements"><ProfileBackButton href={`/profile/${profile.username}`} /><h1>Достижения <span className="community-muted">{earned.length}</span></h1>
      {earned.length ? <div className="achievement-cards">{earned.map(item => <article className="community-panel" data-rarity={item.rarity} key={item.key}><Image className="achievement-art" src={achievementImage(item.key)} width={144} height={144} alt="" /><h2>{item.label}</h2><span className="achievement-rarity" data-rarity={item.rarity}>{ACHIEVEMENT_RARITIES[item.rarity]}</span><p>{item.description}</p><span className="community-muted">Получено</span></article>)}</div> : <div className="wall-empty-card">Пока нет полученных достижений.</div>}
      {locked.length > 0 && <>
        <h2 className="achievement-locked-title">Ещё не получены <span className="community-muted">{locked.length}</span></h2>
        <div className="achievement-cards">{locked.map(({ item, completion }) => <article className="community-panel is-locked" data-rarity={item.rarity} key={item.key}>
          <div className="achievement-locked-head"><Image className="achievement-art" src={achievementImage(item.key)} width={72} height={72} alt="" />
            <div><h3>{item.label}</h3><span className="achievement-rarity" data-rarity={item.rarity}>{ACHIEVEMENT_RARITIES[item.rarity]}</span></div>
            <span className="achievement-percent" aria-label={`Выполнено ${Math.round(completion * 100)}%`}>{Math.round(completion * 100)}%</span></div>
          <p>{item.description}</p>
          <AchievementSteps item={item} progress={community.progress} unlocked={false} />
        </article>)}</div>
      </>}
    </section>
  </BrandShell>;
}
