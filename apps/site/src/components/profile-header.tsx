import { AvatarFrame } from '@/components/avatar-frame';
import Image from 'next/image';
import type { ReactNode } from 'react';
import { joinedLabel } from '@/lib/last-seen';

const META_ICON = { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;

export function ProfileHeader({ name, username, bio, createdAt, avatarSrc, bannerSrc, actions, status, tags, avatarControl, bannerControl, frame = 'none' }: {
  frame?: import('@/lib/profile-appearance').ProfileAppearance['frame'];
  name: string;
  username: string;
  bio?: string | null;
  createdAt: Date | string;
  avatarSrc?: string | null;
  bannerSrc?: string | null;
  actions?: ReactNode;
  status?: ReactNode;
  tags?: ReactNode;
  avatarControl?: ReactNode;
  bannerControl?: ReactNode;
}) {
  const date = joinedLabel(createdAt);
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
        <p className="community-meta">
          <span className="community-meta-item"><svg {...META_ICON}><circle cx="12" cy="12" r="4" /><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" /></svg>@{username}</span>
          <span className="community-meta-item community-joined"><svg {...META_ICON}><rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>С нами с {date}</span>
        </p>{bio && <p className="community-bio">{bio}</p>}{tags}
      </div>
      <div className="community-hero-actions">{actions}</div>
    </div>
  </header>;
}
