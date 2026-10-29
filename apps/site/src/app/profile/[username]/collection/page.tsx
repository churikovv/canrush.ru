import '@/styles/shared.css';
import { profileThemeAttributes } from '@/lib/profile-appearance';
import '@/styles/profile.css';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import Link from '@/components/navigation-progress';
import { BrandShell } from '@/components/brand-shell';
import { BrandCollectionList, BrandCollectionStats } from '@/components/brand-collection';
import { ProfileBackButton } from '@/components/profile-back-button';
import { ProfileNavigation } from '@/components/profile-navigation';
import { ProfileSubpageOwner } from '@/components/profile-subpage-owner';
import { auth } from '@/lib/auth';
import { getBrandCollections } from '@/lib/brand-collection';
import { getProfileByUsername } from '@/lib/profile';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Коллекция вкусов', robots: { index: false, follow: false } };

export default async function BrandCollectionPage({ params }: { params: Promise<{ username: string }> }) {
  const [{ username }, session] = await Promise.all([params, auth.api.getSession({ headers: await headers() })]);
  const profile = await getProfileByUsername(username);
  if (!profile) notFound();
  const isOwn = session?.user.id === profile.id;
  const summary = await getBrandCollections(profile.id);

  return <BrandShell headerAction={<ProfileNavigation active="profile" />} surfaceClassName="profile-surface">
    <section className="community-directory brand-collection-page" {...profileThemeAttributes(profile.profileAppearance?.theme)}>
      <ProfileBackButton href={isOwn ? '/profile' : `/profile/${profile.username}`} />
      <div className="profile-subpage-title"><h1>Коллекция вкусов</h1>{!isOwn && <ProfileSubpageOwner profile={profile} />}</div>
      <div className="community-panel brand-collection-intro">
        <BrandCollectionStats summary={summary} />
        <p className="community-muted">Вкус попадает в коллекцию, когда {isOwn ? 'вы оставляете' : 'пользователь оставляет'} на него отзыв или отмечает банку в трекере выпитого. За 25, 50, 75 и 100% каждого бренда начисляется опыт.
          {isOwn && <> Нажмите на банку, чтобы открыть карточку напитка, или <Link href={`/profile/${profile.username}/calendar#add-drink`}>отметьте энергетик</Link>.</>}</p>
      </div>
      <BrandCollectionList summary={summary} />
    </section>
  </BrandShell>;
}
