import Image from 'next/image';
import Link from '@/components/navigation-progress';
import { displayName } from '@/components/wall-post';
import type { ProfileData } from '@/lib/profile';

/** Whose page this is, under the h1 of profile subpages viewed by someone else. */
export function ProfileSubpageOwner({ profile }: { profile: Pick<ProfileData, 'username' | 'avatarId' | 'name'> }) {
  return <Link className="profile-subpage-owner" href={`/profile/${profile.username}`}>
    <span className="profile-subpage-owner-avatar" aria-hidden="true">{profile.avatarId
      ? <Image src={`/api/profile-images/${profile.avatarId}`} width={32} height={32} alt="" unoptimized />
      : displayName(profile).slice(0, 1).toLocaleUpperCase('ru-RU')}</span>
    <span><strong>{displayName(profile)}</strong> <small>@{profile.username}</small></span>
  </Link>;
}
