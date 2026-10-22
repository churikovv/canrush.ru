import Image from 'next/image';
import Link from '@/components/navigation-progress';
import { ProfileExperience } from '@/components/profile-experience';
import { ReviewDiscussion } from '@/components/review-discussion';
import { ReviewPhotoGallery } from '@/components/review-photo-gallery';
import { WallPostBody } from '@/components/wall-post-body';
import { profileTagLabel } from '@/lib/profile-achievements';
import type { WallPostRow } from '@/lib/profile-community';
import type { WallInteraction } from '@/lib/wall-discussions';

export function displayName(profile: { name: string; username: string | null }): string {
  const name = profile.name.trim();
  return name && !name.includes('@') ? name : profile.username || 'Участник';
}

const postTime = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Moscow' });

interface WallPostProps {
  post: WallPostRow;
  interaction?: WallInteraction;
  canDelete: boolean;
  /** Only the author may edit; the wall owner can just delete. */
  canEdit: boolean;
  /** Set in the feed: whose wall the record lives on. Omitted on the wall itself. */
  owner?: { username: string | null; name: string; avatarId?: string | null };
}

/** A wall record. The same row is rendered on the owner's wall and in the feed. */
export function WallPost({ post, interaction, canDelete, canEdit, owner }: WallPostProps) {
  const time = <time dateTime={post.createdAt.toISOString()}>{postTime.format(post.createdAt)}</time>;
  const onOtherWall = owner && post.profileId !== post.userId;
  const profileHref = post.username ? `/profile/${post.username}` : undefined;
  const avatar = post.avatarId ? <Image src={`/api/profile-images/${post.avatarId}`} width={40} height={40} unoptimized alt="" /> : (post.username ?? post.name).slice(0, 1).toUpperCase();
  const ownerAvatar = owner?.avatarId ? <Image src={`/api/profile-images/${owner.avatarId}`} width={20} height={20} unoptimized alt="" /> : (owner?.username ?? owner?.name ?? '').slice(0, 1).toUpperCase();
  return <article id={`wall-post-${post.id}`} className={`wall-comment${onOtherWall ? ' is-on-other-wall' : ''}`}>
    {onOtherWall && owner.username && <Link className="wall-post-target" href={`/profile/${owner.username}#wall`}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5v6a4 4 0 0 0 4 4h11" /><path d="m15 11 4 4-4 4" /></svg>
      <span className="wall-post-target-label">На стене</span>
      <span className="wall-post-target-avatar" aria-hidden="true">{ownerAvatar}</span>
      <strong>{displayName(owner)}</strong>
    </Link>}
    <WallPostBody id={post.id} text={post.text} canEdit={canEdit} canDelete={canDelete} canReport={Boolean(interaction?.authenticated) && !canEdit} heading={<>
      {profileHref ? <Link className="wall-avatar" href={profileHref} tabIndex={-1} aria-hidden="true">{avatar}</Link> : <span className="wall-avatar">{avatar}</span>}
      <div className="wall-post-meta">
        <div className="wall-post-name">
          {profileHref ? <Link className="wall-post-author" href={profileHref}>{displayName(post)}</Link> : <strong className="wall-post-author">{displayName(post)}</strong>}
          {profileTagLabel(post.tag) && <span className="profile-tag" data-tag={post.tag}>{profileTagLabel(post.tag)}</span>}
          {post.username && <ProfileExperience username={post.username} initial={{ xp: post.xp, rank: null }} />}
        </div>
        <div className="wall-post-sub">
          {profileHref && <Link href={profileHref}>@{post.username}</Link>}
          {owner?.username ? <Link href={`/profile/${owner.username}#wall`} title="Открыть стену">{time}</Link> : <a href={`#wall-post-${post.id}`} title="Ссылка на запись">{time}</a>}
          {post.editedAt && <span title={`Изменено ${postTime.format(post.editedAt)}`}>изменено</span>}
        </div>
      </div>
    </>}>
      <ReviewPhotoGallery photos={post.photos} kinds={post.mediaKinds} source="wall-photos" />
      <ReviewDiscussion reviewId={post.id} target="wall" initial={interaction} />
    </WallPostBody>
  </article>;
}
