import { ReviewPhotoGallery } from '@/components/review-photo-gallery';
import { getExperience } from '@/lib/profile-experience';
import { ProfileExperience } from '@/components/profile-experience';
import { profileTagLabel } from '@/lib/profile-achievements';
import Image from 'next/image';
import Link from 'next/link';
import { SignOutButton } from '@/components/sign-out-button';
import type { ProfileData } from '@/lib/profile';
import { COMMUNITY_PAGE_SIZE, getConnections, getPresence, getProfileCommunity, getProfileRatings, getProfileWall } from '@/lib/profile-community';
import { PROFILE_ACHIEVEMENTS, visibleProfileAchievements } from '@/lib/profile-achievements';
import { AchievementPicker, DeleteWallComment, FollowControl, PresenceSetting, WallComposer } from '@/components/profile-community-controls';
import { ProfileHeader } from '@/components/profile-header';
import { ProfilePresence } from '@/components/profile-presence';

interface ProfileViewProps {
  profile: ProfileData;
  isOwn: boolean;
  favoritesHref: string;
  tierListsHref: string;
  adminHref?: string;
  viewerId?: string;
  viewerIsAdmin?: boolean;
  wallPage?: number;
}

function displayName(profile: ProfileData): string {
  const name = profile.name.trim();
  return name && !name.includes('@') ? name : profile.username;
}

export async function ProfileView({ profile, isOwn, favoritesHref, tierListsHref, adminHref, viewerId, viewerIsAdmin = false, wallPage = 1 }: ProfileViewProps) {
  const [community, ratings, wall, presence, friends] = await Promise.all([
    getProfileCommunity(profile.id, viewerId), getProfileRatings(profile.id), getProfileWall(profile.id, wallPage), getPresence(profile.id), getConnections(profile.id, 'friends'),
  ]);
  const experience = (await getExperience([profile.username]))[profile.username];
  const visibleAchievements = visibleProfileAchievements(viewerIsAdmin);
  const visibleEarned = community.earned.filter(key => visibleAchievements.some(item => item.key === key));
  const base = `/profile/${profile.username}`;
  const telegramHref = profile.telegramChannel ? `https://t.me/${profile.telegramChannel}` : undefined;
  const pages = Math.ceil(wall.count / COMMUNITY_PAGE_SIZE);
  const formatScore = (value: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(value);

  return (
    <div className={`community-profile${isOwn ? ' ym-hide-content' : ''}`}>
      <ProfileHeader name={displayName(profile)} username={profile.username} createdAt={profile.createdAt}
        avatarSrc={profile.avatarId ? `/api/profile-images/${profile.avatarId}` : null}
        bannerSrc={profile.bannerId ? `/api/profile-images/${profile.bannerId}` : null}
        status={<ProfilePresence userId={profile.id} initial={presence} />}
        tags={<div className="profile-tags"><ProfileExperience key={`${profile.username}:${experience?.xp}`} username={profile.username} initial={experience} />{community.tags.map(tag => <a key={tag} href="#achievements" className="profile-tag">{PROFILE_ACHIEVEMENTS.find(item => item.key === tag)?.label}</a>)}</div>}
        actions={isOwn ? <Link href="/profile/edit" className="community-button community-button-secondary">Редактировать профиль</Link>
          : viewerId ? <FollowControl targetId={profile.id} following={community.isFollowing} mutual={community.followsYou} />
          : <Link className="community-button" href="/sign-in">Войти и подписаться</Link>} />

      <nav className="community-shortcuts" aria-label="Активность пользователя">
        {[{ href: favoritesHref, label: 'Избранное', count: profile.favoriteCount, icon: 'stat-favorites' },
          { href: `${base}/reviews`, label: 'Отзывы', count: profile.reviewCount, icon: 'stat-reviews' },
          { href: tierListsHref, label: 'Тирлисты', count: profile.tierListCount, icon: 'stat-tierlists' },
          { href: '#achievements', label: 'Достижения', count: visibleEarned.length, icon: 'profile' }].map(item =>
          <Link href={item.href} key={item.label} className="community-shortcut"><Image src={`/brand/icons/${item.icon}.svg`} width={20} height={20} alt="" /><span>{item.label}</span><strong>{item.count}</strong><span className="community-shortcut-arrow" aria-hidden="true">↗</span></Link>)}
      </nav>

      <div className="community-columns">
        <div className="community-main">
          <ProfileExperience key={`${profile.username}:${experience?.xp}`} username={profile.username} initial={experience} expanded />
          <section className="community-panel" aria-labelledby="rating-statistics-title">
            <div className="community-section-heading"><h2 id="rating-statistics-title">Статистика оценок</h2><Link href={`${base}/reviews`}>Все отзывы ↗</Link></div>
            {ratings.count ? <div className="profile-rating-summary">
              <div className="profile-rating-average"><strong>{formatScore(ratings.overall)}<span> / 10</span></strong><p>Средняя оценка</p><dl>{([['Дизайн', ratings.design], ['Вкус', ratings.taste]] as const).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{formatScore(value)}</dd></div>)}</dl></div>
              <div className="profile-rating-distribution" role="img" aria-label={`Распределение оценок: ${ratings.histogram.map(row => `${row.score} баллов: ${row.count}`).join(', ')}. Общая оценка отзыва округлена до целого.`}>
                {ratings.histogram.map(row => <div key={row.score}><span>{row.score} <span aria-hidden="true">★</span></span><span className="profile-rating-track"><span style={{ width: `${row.count / ratings.count * 100}%` }} /></span><span>{row.count}</span></div>)}
                <p>Оценок: {ratings.count}</p>
              </div>
            </div> : <div className="community-empty"><p>Оценок пока нет.</p>{isOwn && <Link href="/catalog">Выбрать напиток и оставить отзыв ↗</Link>}</div>}
          </section>

          <section className="community-panel" id="achievements" aria-labelledby="achievements-title">
            <div className="community-section-heading"><h2 id="achievements-title">Теги за достижения</h2><span className="community-muted">{visibleEarned.length} / {visibleAchievements.length}</span></div>
            {isOwn && <p className="community-section-note">Выберите один тег. Он появится в профиле и рядом с ником в отзывах.</p>}
            <AchievementPicker key={community.tags.join(',')} earned={visibleEarned} selected={community.tags} progress={community.progress} isOwn={isOwn} viewerIsAdmin={viewerIsAdmin} />
          </section>

          <section className="community-panel" id="wall" aria-labelledby="wall-title">
            <div className="community-section-heading"><h2 id="wall-title">Стена <span>{wall.count}</span></h2></div>
            {viewerId ? <WallComposer targetId={profile.id} /> : <p className="community-empty"><Link href="/sign-in">Войдите</Link>, чтобы оставить комментарий.</p>}
            {wall.comments.length ? <div className="wall-comments">{wall.comments.map(comment => <article key={comment.id} className="wall-comment">
              <div className="wall-comment-heading"><span className="wall-avatar">{comment.avatarId ? <Image src={`/api/profile-images/${comment.avatarId}`} width={36} height={36} unoptimized alt="" /> : (comment.username ?? comment.name).slice(0, 1).toUpperCase()}</span><Link href={comment.username ? `/profile/${comment.username}` : '#wall'} className="wall-author">@{comment.username ?? 'пользователь'}</Link>{profileTagLabel(comment.tag) && <span className="profile-tag">{profileTagLabel(comment.tag)}</span>}{comment.username && <ProfileExperience username={comment.username} initial={{ xp: comment.xp, rank: null }} />}<time dateTime={comment.createdAt.toISOString()}>{new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Moscow' }).format(comment.createdAt)}</time></div>
              <p>{comment.text}</p><ReviewPhotoGallery photos={comment.photos} source="wall-photos" />
              {(isOwn || viewerId === comment.userId) && <DeleteWallComment id={comment.id} />}
            </article>)}</div> : <p className="community-empty">Здесь пока тихо. Оставьте первый комментарий.</p>}
            {pages > 1 && <nav className="community-pagination" aria-label="Страницы стены">{wallPage > 1 ? <Link href={`${base}?wallPage=${wallPage - 1}#wall`}>← Назад</Link> : <span />}<span>{wallPage} / {pages}</span>{wallPage < pages ? <Link href={`${base}?wallPage=${wallPage + 1}#wall`}>Далее →</Link> : <span />}</nav>}
          </section>
        </div>

        <aside className="community-sidebar">
          <section className="community-panel" aria-labelledby="connections-title">
            <h2 id="connections-title">Круг общения</h2>
            <nav className="community-connections" aria-label="Подписки и друзья">{([{ key: 'followers', label: 'Подписчики', count: community.followers }, { key: 'following', label: 'Подписки', count: community.following }, { key: 'friends', label: 'Друзья', count: community.friends }] as const).map(item => <Link key={item.key} href={`${base}/connections?type=${item.key}`}><span>{item.label}</span><strong>{item.count}</strong><span aria-hidden="true">→</span></Link>)}</nav>
            <p className="community-section-note">Друзья подписаны друг на друга.</p>
            {friends.users.length > 0 && <div className="community-friend-list">{friends.users.slice(0, 6).map(user => <Link href={`/profile/${user.username}`} key={user.username}><span aria-hidden="true">{user.avatarId ? <Image src={`/api/profile-images/${user.avatarId}`} width={32} height={32} unoptimized alt="" /> : user.username.slice(0, 1).toUpperCase()}</span>@{user.username}</Link>)}</div>}
          </section>
          <section className="community-panel" aria-labelledby="profile-about-title"><h2 id="profile-about-title">О профиле</h2>
            {telegramHref ? <a className="community-channel" href={telegramHref} target="_blank" rel="noreferrer"><Image src="/brand/icons/channel.svg" width={18} height={18} alt="" />@{profile.telegramChannel} ↗</a> : <p className="community-muted">Канал не указан</p>}
            {isOwn && <PresenceSetting key={String(community.showOnline)} visible={community.showOnline} />}
            {adminHref && <Link className="community-admin" href={adminHref}>Администрирование ↗</Link>}
          </section>
          {isOwn && <SignOutButton />}
        </aside>
      </div>
    </div>
  );
}
