'use client';
import { useId, useState } from 'react';
import Image from 'next/image';
import Link from '@/components/navigation-progress';

const tabs = [{ key: 'followers', label: 'Подписчики', empty: 'Подписчиков пока нет' }, { key: 'following', label: 'Подписки', empty: 'Подписок пока нет' }, { key: 'friends', label: 'Друзья', empty: 'Друзей пока нет' }] as const;
type Kind = typeof tabs[number]['key'];
type Preview = { count: number; users: { username: string; name: string; avatarId: string | null }[] };
export function ProfileConnections({ username, groups }: { username: string; groups: Record<Kind, Preview> }) {
  const [active, setActive] = useState<Kind>('followers');
  const id = useId();
  const group = groups[active];
  return <section className="community-panel profile-connections" aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`}>Круг общения</h2>
    <div className="profile-connection-tabs" role="tablist" aria-label="Круг общения">
      {tabs.map((tab, index) => <button key={tab.key} type="button" role="tab" id={`${id}-${tab.key}`} aria-selected={active === tab.key} aria-controls={`${id}-panel`} tabIndex={active === tab.key ? 0 : -1} onClick={() => setActive(tab.key)} onKeyDown={event => {
        const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1;
        if (next < 0) return; event.preventDefault(); const key = tabs[next]!.key; setActive(key); document.getElementById(`${id}-${key}`)?.focus();
      }}>{tab.label}<span>{groups[tab.key].count}</span></button>)}
    </div>
    <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${active}`} tabIndex={0} className="profile-connections-preview">
      {group.users.length ? <>
        <div className="profile-connection-avatars">{group.users.map(user => <Link key={user.username} href={`/profile/${encodeURIComponent(user.username)}`} aria-label={`${user.name && !user.name.includes('@') ? user.name : user.username} (@${user.username})`} title={`@${user.username}`}>
          {user.avatarId ? <Image src={`/api/profile-images/${user.avatarId}`} width={48} height={48} unoptimized alt="" /> : <span aria-hidden="true">{user.username.charAt(0).toUpperCase()}</span>}
        </Link>)}</div>
        <Link className="profile-connections-all" href={`/profile/${encodeURIComponent(username)}/connections?type=${active}`}>Все <span aria-hidden="true">→</span></Link>
      </> : <p className="community-muted">{tabs.find(tab => tab.key === active)!.empty}</p>}
    </div>
  </section>;
}
