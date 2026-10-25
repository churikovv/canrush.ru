import '@/styles/shared.css';
import '@/styles/profile.css';
import '@/styles/leaderboard.css';
import Image from 'next/image';
import Link from '@/components/navigation-progress';
import { AvatarFrame } from '@/components/avatar-frame';
import { BrandShell } from '@/components/brand-shell';
import { LevelTierGlyph } from '@/components/level-badge';
import { MonthlyTop } from '@/components/monthly-top';
import { ProfileNavigation } from '@/components/profile-navigation';
import { experienceLevel } from '@/lib/experience-level';
import { levelRank } from '@/lib/level-tier';
import { getMonthlyTop, settleMonthlyTop } from '@/lib/monthly-top';
import { profileTagLabel } from '@/lib/profile-achievements';
import { getLeaderboard, type LeaderboardRow } from '@/lib/profile-experience';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Рейтинг участников' };

const icon = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;
const Flame = () => <svg {...icon} fill="currentColor" stroke="none"><path d="M12.6 2.2c.4 2.6-.6 4.3-1.9 5.8-1.4 1.6-3.2 3.1-3.2 6.1A4.6 4.6 0 0 0 12 18.8a4.6 4.6 0 0 0 4.5-4.7c0-1.4-.5-2.6-1.3-3.6.1 1.4-.4 2.4-1.3 2.9.4-3.3-.4-8.3-1.3-11.2ZM6 13.8c0-.9.1-1.7.4-2.4-.9 1-1.9 2.6-1.9 4.6A7.5 7.5 0 0 0 12 23.5 7.5 7.5 0 0 0 19.5 16c0-1-.2-2-.6-2.9A6.3 6.3 0 0 1 12 20.6 6.4 6.4 0 0 1 6 13.8Z" /></svg>;
const Star = () => <svg {...icon}><path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5Z" /></svg>;
const Can = () => <svg {...icon}><path d="M8 3h8l1 3v13a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V6l1-3ZM7 7h10M7 17h10" /></svg>;
const Layers = () => <svg {...icon}><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5" /></svg>;
const Trophy = () => <svg {...icon} width={20} height={20}><path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" /><path d="M7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5M12 14v3M8 20h8M9.5 17h5" /></svg>;
const Medal = () => <svg className="lb-medal" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2h4l1.5 5L10 9 7 2Zm10 0h-4l-1.5 5L14 9l3-7Z" fill="currentColor" opacity=".55" /><circle cx="12" cy="15" r="6.5" fill="currentColor" /><path d="m12 11.6 1 2.1 2.3.3-1.7 1.6.4 2.3-2-1.1-2 1.1.4-2.3-1.7-1.6 2.3-.3 1-2.1Z" fill="#fff" opacity=".85" /></svg>;

const plural = (value: number, one: string, few: string, many: string) => {
  const tens = value % 100, ones = value % 10;
  return tens > 10 && tens < 20 ? many : ones === 1 ? one : ones >= 2 && ones <= 4 ? few : many;
};

/** One row as in a game ladder: place, framed avatar, nick with streak and tag, counters, level tile and XP. */
function Row({ user }: { user: LeaderboardRow }) {
  const { level } = experienceLevel(user.xp);
  const rank = levelRank(level);
  return <li data-rank={user.rank <= 3 ? user.rank : undefined}><Link className="lb-row" href={`/profile/${user.username}`}>
    <span className="lb-rank"><b>{user.rank}</b>{user.rank <= 3 && <Medal />}</span>
    <span className="lb-avatar" data-frame={user.frame}>
      {user.avatarId ? <Image src={`/api/profile-images/${user.avatarId}`} width={56} height={56} unoptimized alt="" /> : <span aria-hidden="true">{user.username[0]?.toUpperCase()}</span>}
      <AvatarFrame frame={user.frame} />
    </span>
    <span className="lb-main">
      <span className="lb-name">
        <strong>{user.username}</strong>
        {user.streak > 0 && <span className="lb-chip lb-streak" title={`Серия ${user.streak} ${plural(user.streak, 'день', 'дня', 'дней')} подряд`}><Flame />{user.streak}<span className="sr-only"> {plural(user.streak, 'день', 'дня', 'дней')} подряд</span></span>}
        {user.tag && <span className="profile-tag" data-tag={user.tag}>{profileTagLabel(user.tag)}{user.tag === 'engine' && user.engineNumber && <small> №{String(user.engineNumber).padStart(3, '0')}</small>}</span>}
      </span>
      <span className="lb-stats">
        <span title="Отзывы"><Star />{user.reviews}<span className="sr-only"> {plural(user.reviews, 'отзыв', 'отзыва', 'отзывов')}</span></span>
        <span title="Банок в календаре"><Can />{user.cans}<span className="sr-only"> {plural(user.cans, 'банка', 'банки', 'банок')}</span></span>
        <span title="Тирлисты"><Layers />{user.tierLists}<span className="sr-only"> {plural(user.tierLists, 'тирлист', 'тирлиста', 'тирлистов')}</span></span>
      </span>
    </span>
    <span className="lb-level" data-level-tier={rank.tier.key} title={rank.label}><LevelTierGlyph tier={rank.tier.key} /><b>{level}</b><span className="sr-only"> уровень</span></span>
    <strong className="lb-xp"><Trophy />{user.xp.toLocaleString('ru-RU')}<small>XP</small></strong>
  </Link></li>;
}

export default async function LeaderboardPage() {
  await settleMonthlyTop();
  const [users, monthly] = await Promise.all([getLeaderboard(), getMonthlyTop()]);
  return <BrandShell headerAction={<ProfileNavigation active="profile" />} surfaceClassName="profile-surface"><div className="community-profile">
    <div className="community-section-heading"><h1>Рейтинг участников</h1><Link href="/profile">Мой профиль ↗</Link></div>
    <MonthlyTop data={monthly} />
    <h2 className="leaderboard-subheading">За всё время</h2>
    <p className="community-section-note">Топ 100 по опыту за всё время. При равном XP участники делят место.</p>
    {users.length ? <div className="lb-table">
      <div className="lb-head" aria-hidden="true"><span>#</span><span>Участник</span><span>Уровень</span><span>Опыт</span></div>
      <ol className="lb-list">{users.map(user => <Row key={user.username} user={user} />)}</ol>
    </div> : <p className="community-empty">Первый отзыв — первый шаг в рейтинг.</p>}
  </div></BrandShell>;
}
