import Image from 'next/image';
import Link from '@/components/navigation-progress';
import { ProfileExperience } from '@/components/profile-experience';
import { profileTagLabel } from '@/lib/profile-achievements';
import type { TierListAuthor as Author } from '@/lib/tier-list-types';
export function TierListAuthor({ author }: { author: Author }) {
  const name = author.name.trim() && !author.name.includes('@') ? author.name : author.username;
  const tag = profileTagLabel(author.tag);
  return <div className="tier-author">
    <Link className="tier-author-avatar" href={`/profile/${author.username}`} aria-label={`Профиль ${name}`}>{author.avatarId ? <Image src={`/api/profile-images/${author.avatarId}`} width={40} height={40} unoptimized alt="" /> : <span>{name.slice(0, 1).toUpperCase()}</span>}</Link>
    <div className="tier-author-details"><Link className="tier-author-name" href={`/profile/${author.username}`}><strong>{name}</strong><span>@{author.username}</span></Link><div className="tier-author-badges">{tag && <span className="profile-tag" data-tag={author.tag}>{tag}</span>}<ProfileExperience username={author.username} initial={{ xp: author.xp ?? 0, rank: null }} /></div></div>
  </div>;
}
