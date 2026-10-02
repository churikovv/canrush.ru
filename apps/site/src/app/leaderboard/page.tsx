import Image from 'next/image';
import Link from 'next/link';
import { BrandShell } from '@/components/brand-shell';
import { ProfileNavigation } from '@/components/profile-navigation';
import { getLeaderboard } from '@/lib/profile-experience';
import { experienceLevel } from '@/lib/experience-level';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Рейтинг участников' };
export default async function LeaderboardPage() {
  const users = await getLeaderboard();
  return <BrandShell headerAction={<ProfileNavigation active="profile" />} surfaceClassName="profile-surface"><div className="community-profile"><div className="community-section-heading"><h1>Рейтинг участников</h1><Link href="/profile">Мой профиль ↗</Link></div><p className="community-section-note">Топ 100 по опыту за всё время. При равном XP участники делят место.</p><ol className="experience-leaderboard">{users.map(user => <li key={user.username}><Link href={`/profile/${user.username}`}><span className="leaderboard-rank">{user.rank}</span><span className="wall-avatar">{user.avatarId ? <Image src={`/api/profile-images/${user.avatarId}`} width={40} height={40} unoptimized alt="" /> : user.username[0]?.toUpperCase()}</span><span className="leaderboard-name">@{user.username}<small>Уровень {experienceLevel(user.xp).level}</small></span><strong>{user.xp.toLocaleString('ru-RU')} XP</strong></Link></li>)}</ol>{!users.length && <p className="community-empty">Первый отзыв — первый шаг в рейтинг.</p>}</div></BrandShell>;
}
