import { AvatarFrame } from '@/components/avatar-frame';
import Image from 'next/image';
import type { ReactNode } from 'react';

export function ProfileHeader({ name, username, createdAt, avatarSrc, bannerSrc, actions, status, tags, avatarControl, bannerControl, frame = 'none' }: {
  frame?: import('@/lib/profile-appearance').ProfileAppearance['frame'];
  name: string;
  username: string;
  createdAt: Date | string;
  avatarSrc?: string | null;
  bannerSrc?: string | null;
  actions?: ReactNode;
  status?: ReactNode;
  tags?: ReactNode;
  avatarControl?: ReactNode;
  bannerControl?: ReactNode;
}) {
  const date = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric', timeZone: 'Europe/Moscow' }).format(new Date(createdAt));
  return <header className="community-hero">
    <div className={`community-cover${bannerSrc ? ' community-cover-custom' : ''}`}>
      {bannerSrc ? <Image src={bannerSrc} fill sizes="(max-width: 1200px) 100vw, 1120px" unoptimized alt="Баннер профиля" priority />
        : <Image src="/brand/profile-illustration.png" width={188} height={120} alt="" priority />}
      {bannerControl}
    </div>
    <div className="community-identity">
      <span data-frame={frame} className={`community-avatar${avatarSrc ? ' community-avatar-custom' : ''}`}>
        <Image src={avatarSrc ?? '/brand/icons/profile-avatar.svg'} width={avatarSrc ? 80 : 32} height={avatarSrc ? 80 : 32} unoptimized={Boolean(avatarSrc)} alt={avatarSrc ? `Аватар ${name}` : ''} />
        <AvatarFrame frame={frame} />
        {avatarControl}
      </span>
      <div className="community-name"><div className="community-name-line"><h1>{name}</h1>{status}</div>
        <p>@{username} <span>· С нами с {date}</span></p>{tags}
      </div>
      <div className="community-hero-actions">{actions}</div>
    </div>
  </header>;
}
