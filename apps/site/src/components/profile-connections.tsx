import Image from 'next/image';
import Link from '@/components/navigation-progress';

type Kind = 'followers' | 'following' | 'friends';
type Preview = { count: number; users: { username: string; name: string; avatarId: string | null }[] };
export function ProfileConnections({ username, groups }: { username: string; groups: Record<Kind, Preview> }) {
  const href = (type: Kind) => `/profile/${encodeURIComponent(username)}/connections?type=${type}`;
  const friends = groups.friends.users.slice(0, groups.friends.count > 8 ? 7 : 8);
  const remaining = Math.max(0, groups.friends.count - friends.length);
  return <div className="profile-social-summary">
    <nav className="profile-social-counts" aria-label="Подписчики и подписки">
      <Link href={href('followers')}><span>Подписчики</span><strong>{groups.followers.count}</strong></Link>
      <Link href={href('following')}><span>Подписки</span><strong>{groups.following.count}</strong></Link>
    </nav>
    <section className="community-panel profile-friends" aria-label="Друзья">
      <div className="profile-friends-heading">
        <h2><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="9" cy="7" r="4"/><path d="M2 21v-3a6 6 0 0 1 12 0v3M17 3a4 4 0 0 1 0 8m1 3a6 6 0 0 1 4 5v2"/></svg>Друзья <span>· {groups.friends.count}</span></h2>
        <Link href={href('friends')}>Все <span aria-hidden="true">→</span></Link>
      </div>
      {friends.length ? <div className="profile-friends-avatars">{friends.map(user => <Link key={user.username} href={`/profile/${encodeURIComponent(user.username)}`} aria-label={`${user.name && !user.name.includes('@') ? user.name : user.username} (@${user.username})`} title={`@${user.username}`}>
        {user.avatarId ? <Image src={`/api/profile-images/${user.avatarId}`} width={80} height={80} unoptimized alt="" /> : <span aria-hidden="true">{user.username.charAt(0).toUpperCase()}</span>}
      </Link>)}{remaining > 0 && <Link href={href('friends')} aria-label={`Ещё друзей: ${remaining}`}>+{remaining}</Link>}</div> : <p className="community-muted">Друзей пока нет</p>}
    </section>
  </div>;
}
