import { ProfileCompatibility } from '@/components/profile-compatibility';
import { isBlockedByViewer } from '@/lib/member-blocks';
import { BlockMemberButton } from '@/components/block-member-button';
import { MoreActions } from '@/components/more-actions';
import { profileThemeAttributes } from '@/lib/profile-appearance';
import { getProfileCompatibility } from '@/lib/profile-compatibility-data';
import { catalogGroupSlug, flavorName } from '@/lib/catalog-query';
import { getWallInteractions } from '@/lib/wall-discussions';
import { ProfileBlock, ProfileBlocks } from '@/components/profile-blocks';
import { getFavoriteGroups } from '@/lib/catalog';
import { ProfileConnections } from '@/components/profile-connections';
import { getListings } from '@/lib/market';
import { formatPrice } from '@/lib/market-fields';
import { ProfileReportMenuItem } from '@/components/profile-report-form';
import { ProfileRatingStats } from '@/components/profile-rating-stats';
import { getExperience } from '@/lib/profile-experience';
import { ProfileExperience } from '@/components/profile-experience';
import Image from 'next/image';
import type { CSSProperties } from 'react';
import Link from '@/components/navigation-progress';
import type { ProfileData } from '@/lib/profile';
import { COMMUNITY_PAGE_SIZE, getConnections, getLastSeen, getPresence, getProfileCommunity, getProfileRatings, getProfileWall } from '@/lib/profile-community';
import { PROFILE_ACHIEVEMENTS, visibleProfileAchievements } from '@/lib/profile-achievements';
import { WallPost, displayName } from '@/components/wall-post';
import { FollowControl, PresenceSetting, WallComposer } from '@/components/profile-community-controls';
import { ProfileHeader } from '@/components/profile-header';
import { DrinkCalendarBlock } from '@/components/drink-calendar-block';
import { BrandCollectionBlock } from '@/components/brand-collection';
import { getBrandCollections } from '@/lib/brand-collection';
import { listPublishedDrinksByOwner } from '@/lib/catalog-drinks';
import { ProfilePresence } from '@/components/profile-presence';
import { SignInPrompt } from '@/components/sign-in-prompt';

interface ProfileViewProps {
  profile: ProfileData;
  isOwn: boolean;
  favoritesHref: string;
  tierListsHref: string;
  viewerId?: string;
  viewerIsAdmin?: boolean;
  wallPage?: number;
}

const count = new Intl.NumberFormat('ru-RU');

function TelegramGlyph() {
  return <svg width="18" height="18" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true" focusable="false"><path fillRule="evenodd" clipRule="evenodd" d="M9.8885 2.465C10.0121 2.413 10.1473 2.39506 10.2801 2.41306C10.413 2.43106 10.5386 2.48433 10.6438 2.56734C10.7491 2.65035 10.8302 2.76006 10.8787 2.88504C10.9272 3.01003 10.9413 3.14572 10.9195 3.278L9.7855 10.1565C9.6755 10.82 8.9475 11.2005 8.339 10.87C7.83 10.5935 7.074 10.1675 6.394 9.723C6.054 9.5005 5.0125 8.788 5.1405 8.281C5.2505 7.8475 7.0005 6.2185 8.0005 5.25C8.393 4.8695 8.214 4.65 7.7505 5C6.5995 5.869 4.7515 7.1905 4.1405 7.5625C3.6015 7.8905 3.3205 7.9465 2.9845 7.8905C2.3715 7.7885 1.803 7.6305 1.339 7.438C0.712 7.178 0.7425 6.316 1.3385 6.065L9.8885 2.465Z" /></svg>;
}

export async function ProfileView({ profile, isOwn, favoritesHref, tierListsHref, viewerId, viewerIsAdmin = false, wallPage = 1 }: ProfileViewProps) {
  const [community, ratings, wall, presence, lastSeen, friends, listings, favorites, compatibility, collection, addedDrinks] = await Promise.all([
    getProfileCommunity(profile.id, viewerId), getProfileRatings(profile.id), getProfileWall(profile.id, wallPage, viewerId ?? null), getPresence(profile.id), getLastSeen(profile.id), getConnections(profile.id, 'friends'), getListings(1, isOwn ? profile.id : undefined, false, profile.username), getFavoriteGroups(profile.id), !isOwn && viewerId ? getProfileCompatibility(viewerId, profile.id) : null, getBrandCollections(profile.id), listPublishedDrinksByOwner(profile.id),
  ]);
  const blockedByViewer = !isOwn && viewerId ? await isBlockedByViewer(viewerId, profile.id) : false;
  const wallInteractions = await getWallInteractions(wall.comments.map(comment => comment.id), viewerId ?? null);
  const experience = (await getExperience([profile.username]))[profile.username];
  const visibleAchievements = visibleProfileAchievements(viewerIsAdmin, community.earned);
  const visibleEarned = community.earned.filter(key => visibleAchievements.some(item => item.key === key));
  const base = `/profile/${profile.username}`;
  const telegramHref = profile.telegramChannel ? `https://t.me/${profile.telegramChannel}` : undefined;
  const showTelegram = !profile.profileLayout?.hiddenFields?.includes('telegramUsername');
  const showChannel = !profile.profileLayout?.hiddenFields?.includes('telegramChannel');
  const pages = Math.ceil(wall.count / COMMUNITY_PAGE_SIZE);

  return (
    <div {...profileThemeAttributes(profile.profileAppearance?.theme)} className={`community-profile${isOwn ? ' ym-hide-content' : ''}`}>
      <ProfileHeader frame={profile.profileAppearance?.frame} name={displayName(profile)} username={profile.username} createdAt={profile.createdAt}
        avatarSrc={profile.avatarId ? `/api/profile-images/${profile.avatarId}` : null}
        avatarId={profile.avatarId}
        bannerSrc={profile.bannerId ? `/api/profile-images/${profile.bannerId}` : null}
        status={<ProfilePresence userId={profile.id} initial={presence} lastSeen={lastSeen} />}
        level={<ProfileExperience key={`${profile.username}:${experience?.xp}`} username={profile.username} initial={experience} />}
        tags={community.tags.length > 0 && <div className="profile-tags">{community.tags.map(tag => <a key={tag} href={`${base}/achievements`} className="profile-tag" data-tag={tag}>{PROFILE_ACHIEVEMENTS.find(item => item.key === tag)?.label}</a>)}</div>}
        actions={isOwn ? undefined
          : viewerId ? <div className="profile-hero-buttons"><FollowControl targetId={profile.id} following={community.isFollowing} mutual={community.followsYou} />
            <MoreActions label="Ещё действия с профилем"><ProfileReportMenuItem targetId={profile.id} /><BlockMemberButton userId={profile.id} name={`@${profile.username}`} initiallyBlocked={blockedByViewer} variant="menuitem" /></MoreActions></div>
          : <Link className="community-button" href="/sign-in">Войти и подписаться</Link>} />


      <nav className="community-shortcuts" aria-label="Активность пользователя">
        {[{ href: `${base}/reviews`, label: 'Отзывы', count: profile.reviewCount, icon: 'stat-reviews' },
          { href: tierListsHref, label: 'Тирлисты', count: profile.tierListCount, icon: 'stat-tierlists' },
          { href: favoritesHref, label: 'Избранное', count: profile.favoriteCount, icon: 'stat-favorites' },
          { href: `${base}/achievements`, label: 'Достижения', count: visibleEarned.length, icon: 'stat-achievements' }].map(item =>
          <Link href={item.href} key={item.label} className="community-shortcut" data-category={item.icon}>
            <span className="community-shortcut-icon" style={{ '--shortcut-icon': `url(/brand/icons/${item.icon}.svg)` } as CSSProperties} aria-hidden="true" />
            <strong>{count.format(item.count)}</strong>
            <span>{item.label}</span>
          </Link>)}
      </nav>

      {profile.bio ? <section className="community-panel profile-bio-block" aria-labelledby="profile-bio-title"><h2 id="profile-bio-title">О себе</h2><p>{profile.bio}</p></section>
        : isOwn ? <Link className="community-panel profile-bio-block is-empty" href="/profile/settings?section=details"><h2>О себе</h2><p>Расскажите, какие энергетики любите</p><span aria-hidden="true">›</span></Link> : null}

      <div className="community-columns">
        <div className="community-main profile-arranged-main"><ProfileBlocks layout={profile.profileLayout}>
          <ProfileBlock block="experience">
          <ProfileExperience key={`${profile.username}:${experience?.xp}`} username={profile.username} initial={experience} expanded achievements={{ earned: visibleEarned.length, total: visibleAchievements.length }} /></ProfileBlock>
          <ProfileBlock block="calendar"><DrinkCalendarBlock userId={profile.id} username={profile.username} isOwn={isOwn} /></ProfileBlock>
          <ProfileBlock block="collection"><BrandCollectionBlock summary={collection} username={profile.username} isOwn={isOwn} /></ProfileBlock>
          <ProfileBlock block="ratings">
          <section className="community-panel" aria-labelledby="rating-statistics-title">
            <div className="community-section-heading"><h2 id="rating-statistics-title">Статистика оценок</h2><Link href={`${base}/reviews`}>Все отзывы ↗</Link></div>
            {ratings.count ? <ProfileRatingStats ratings={ratings} /> : <div className="community-empty"><p>Оценок пока нет.</p>{isOwn && <Link href="/catalog">Выбрать напиток и оставить отзыв ↗</Link>}</div>}
          </section>

          </ProfileBlock><ProfileBlock block="listings">
          <section className="community-panel" aria-labelledby="profile-listings-title">
            <div className="community-section-heading"><h2 id="profile-listings-title">Объявления</h2><Link href={isOwn ? '/market?mine=1' : `/market?seller=${encodeURIComponent(profile.username)}`}>Все ↗</Link></div>
            {listings.items.length ? <div className="profile-listing-previews">{listings.items.slice(0, 2).map(listing => <Link className="profile-listing-preview" key={listing.id} href={`/market/${listing.id}`}>
              <div className="market-card-image">{listing.photos[0] ? <Image src={`/api/market-photos/${listing.photos[0]}?size=thumbnail`} alt={listing.title} width={320} height={320} unoptimized /> : <span>Нет фото</span>}</div>
              <h3>{listing.title}</h3><strong>{formatPrice(listing.price)} / шт.</strong><p>{listing.city}{listing.closed ? ' · В архиве' : ''}</p>
            </Link>)}</div> : <div className="community-empty"><p>{isOwn ? 'Вы пока не создавали объявлений.' : 'Пользователь пока не создавал объявлений.'}</p>{isOwn && <Link href="/market/new">Создать объявление ↗</Link>}</div>}
          </section>

          </ProfileBlock><ProfileBlock block="wall">
          <section className="community-panel" id="wall" aria-labelledby="wall-title">
            <div className="community-section-heading"><h2 id="wall-title">Стена <span>{wall.count}</span></h2><Link href="/feed">В ленте ↗</Link></div>
            {viewerId ? <WallComposer targetId={profile.id} /> : <SignInPrompt title="Напишите на стене" text="Войдите, чтобы оставить запись или ответить на неё." />}
            {wall.comments.length ? <div className="wall-comments">{wall.comments.map(comment => <WallPost key={comment.id} post={comment} interaction={wallInteractions.get(comment.id)} canDelete={isOwn || viewerId === comment.userId} canEdit={viewerId === comment.userId} />)}</div> : <div className="wall-empty-card"><strong>Здесь пока тихо</strong><p>Оставьте первый комментарий.</p></div>}
            {pages > 1 && <nav className="community-pagination" aria-label="Страницы стены">{wallPage > 1 ? <Link href={`${base}?wallPage=${wallPage - 1}#wall`}>← Назад</Link> : <span />}<span>{wallPage} / {pages}</span>{wallPage < pages ? <Link href={`${base}?wallPage=${wallPage + 1}#wall`}>Далее →</Link> : <span />}</nav>}
          </section>
          </ProfileBlock><ProfileBlock block="favorites"><section className="community-panel"><div className="community-section-heading"><h2>Избранное</h2><Link href={favoritesHref}>Все ↗</Link></div>
          {favorites.length ? <div className="profile-favorites-block">{favorites.slice(0, 6).map(group => <Link key={`${group.brand}:${group.flavor}`} href={`/catalog/${catalogGroupSlug(group.brand, group.flavor)}`}>
          {group.coverImageUrl && <Image src={group.coverImageUrl} width={120} height={120} alt="" />}<strong>{group.brand}</strong><span>{flavorName(group.flavor)}</span></Link>)}</div> : <p className="community-muted">Пока нет избранных напитков.</p>}</section></ProfileBlock>
          <ProfileBlock block="drinks"><section className="community-panel" aria-labelledby="profile-drinks-title"><div className="community-section-heading"><h2 id="profile-drinks-title">Добавленные напитки {addedDrinks.total > 0 && <span>{addedDrinks.total}</span>}</h2>{isOwn && <Link href="/catalog/new">Добавить ↗</Link>}</div>
          {addedDrinks.items.length ? <div className="profile-favorites-block">{addedDrinks.items.map(drink => <Link key={drink.id} href={drink.href}>
          <Image src={drink.photo} width={120} height={120} alt="" /><strong>{drink.brand}</strong><span>{drink.name}</span></Link>)}</div>
          : <div className="community-empty"><p>{isOwn ? 'Не нашли энергетик в каталоге? Добавьте его — после проверки он появится здесь и у всех в каталоге.' : 'Пользователь пока не добавлял напитки в каталог.'}</p>{isOwn && <Link href="/catalog/new">Добавить напиток ↗</Link>}</div>}</section></ProfileBlock></ProfileBlocks>

        </div>

        <aside className="community-sidebar profile-arranged-sidebar"><ProfileBlocks layout={profile.profileLayout}><ProfileBlock block="social">
          <ProfileConnections username={profile.username} friends={{ count: friends.count, users: friends.users.slice(0, 8) }} />
          {compatibility && <ProfileCompatibility value={compatibility} username={profile.username} />}
          </ProfileBlock><ProfileBlock block="about"><section className="community-panel profile-about" aria-labelledby="profile-about-title"><h2 id="profile-about-title">О профиле</h2>
            <div className="profile-about-list">
            {showTelegram && (profile.telegramUsername ? <a className="profile-about-row" href={`https://t.me/${profile.telegramUsername}`} target="_blank" rel="noopener noreferrer"><span className="profile-about-icon profile-about-icon-telegram"><TelegramGlyph /></span><span className="profile-about-text"><small>Telegram</small><strong>@{profile.telegramUsername}</strong></span><span className="profile-about-arrow" aria-hidden="true">↗</span></a>
              : isOwn ? <Link className="profile-about-row is-muted" href="/profile/settings?section=telegram"><span className="profile-about-icon"><TelegramGlyph /></span><span className="profile-about-text"><small>Telegram</small><strong>Добавить</strong></span><span className="profile-about-arrow" aria-hidden="true">→</span></Link> : null)}
            {showChannel && (telegramHref ? <a className="profile-about-row" href={telegramHref} target="_blank" rel="noreferrer"><span className="profile-about-icon profile-about-icon-telegram"><svg width="18" height="18" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true" focusable="false"><path fillRule="evenodd" clipRule="evenodd" d="M9.8885 2.465C10.0121 2.413 10.1473 2.39506 10.2801 2.41306C10.413 2.43106 10.5386 2.48433 10.6438 2.56734C10.7491 2.65035 10.8302 2.76006 10.8787 2.88504C10.9272 3.01003 10.9413 3.14572 10.9195 3.278L9.7855 10.1565C9.6755 10.82 8.9475 11.2005 8.339 10.87C7.83 10.5935 7.074 10.1675 6.394 9.723C6.054 9.5005 5.0125 8.788 5.1405 8.281C5.2505 7.8475 7.0005 6.2185 8.0005 5.25C8.393 4.8695 8.214 4.65 7.7505 5C6.5995 5.869 4.7515 7.1905 4.1405 7.5625C3.6015 7.8905 3.3205 7.9465 2.9845 7.8905C2.3715 7.7885 1.803 7.6305 1.339 7.438C0.712 7.178 0.7425 6.316 1.3385 6.065L9.8885 2.465Z" /></svg></span><span className="profile-about-text"><small>Telegram-канал</small><strong>@{profile.telegramChannel}</strong></span><span className="profile-about-arrow" aria-hidden="true">↗</span></a>
              : <div className="profile-about-row is-muted"><span className="profile-about-icon"><svg width="18" height="18" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true" focusable="false"><path fillRule="evenodd" clipRule="evenodd" d="M9.8885 2.465C10.0121 2.413 10.1473 2.39506 10.2801 2.41306C10.413 2.43106 10.5386 2.48433 10.6438 2.56734C10.7491 2.65035 10.8302 2.76006 10.8787 2.88504C10.9272 3.01003 10.9413 3.14572 10.9195 3.278L9.7855 10.1565C9.6755 10.82 8.9475 11.2005 8.339 10.87C7.83 10.5935 7.074 10.1675 6.394 9.723C6.054 9.5005 5.0125 8.788 5.1405 8.281C5.2505 7.8475 7.0005 6.2185 8.0005 5.25C8.393 4.8695 8.214 4.65 7.7505 5C6.5995 5.869 4.7515 7.1905 4.1405 7.5625C3.6015 7.8905 3.3205 7.9465 2.9845 7.8905C2.3715 7.7885 1.803 7.6305 1.339 7.438C0.712 7.178 0.7425 6.316 1.3385 6.065L9.8885 2.465Z" /></svg></span><span className="profile-about-text"><small>Telegram-канал</small><strong>Не указан</strong></span></div>)}
            {isOwn && <PresenceSetting key={String(community.showOnline)} visible={community.showOnline} />}
            </div>
          </section>
          </ProfileBlock></ProfileBlocks>
          {blockedByViewer && <BlockMemberButton userId={profile.id} name={`@${profile.username}`} initiallyBlocked />}
        </aside>
      </div>
    </div>
  );
}
