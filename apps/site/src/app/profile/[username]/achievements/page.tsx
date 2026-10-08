import { ProfileBackButton } from '@/components/profile-back-button';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { isSiteAdminEmail } from '@/lib/admin';
import { getProfileByUsername } from '@/lib/profile';
import { getProfileCommunity } from '@/lib/profile-community';
import { visibleProfileAchievements } from '@/lib/profile-achievements';
import { BrandShell } from '@/components/brand-shell';
import { ProfileNavigation } from '@/components/profile-navigation';
export const metadata = { title: 'Достижения', robots: { index: false, follow: false } };
export default async function AchievementsPage({ params }: { params: Promise<{ username: string }> }) {
  const profile = await getProfileByUsername((await params).username);
  if (!profile) notFound();
  const session = await auth.api.getSession({ headers: await headers() });
  const admin = session ? await isSiteAdminEmail(session.user.email) : false;
  const community = await getProfileCommunity(profile.id, session?.user.id);
  const earned = visibleProfileAchievements(admin).filter(item => community.earned.includes(item.key));
  return <BrandShell headerAction={<ProfileNavigation active="profile" />} surfaceClassName="profile-surface">
    <section className="community-directory profile-achievements"><ProfileBackButton href={`/profile/${profile.username}`} /><h1>Достижения <span className="community-muted">{earned.length}</span></h1>
      {earned.length ? <div className="achievement-cards">{earned.map(item => <article className="community-panel" key={item.key}><h2>{item.label}</h2><p>{item.description}</p><span className="community-muted">Получено</span></article>)}</div> : <div className="wall-empty-card">Пока нет полученных достижений.</div>}
    </section>
  </BrandShell>;
}
