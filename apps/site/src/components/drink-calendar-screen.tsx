import { profileThemeAttributes } from '@/lib/profile-appearance';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import Link from '@/components/navigation-progress';
import { BrandShell } from '@/components/brand-shell';
import Image from 'next/image';
import { BirdSpeech, DrinkBird } from '@/components/drink-bird';
import { DrinkLogForm } from '@/components/drink-log-form';
import { DrinkMonth } from '@/components/drink-month';
import { DrinkSummaryActions } from '@/components/drink-share-button';
import { ProfileBackButton } from '@/components/profile-back-button';
import { ProfileNavigation } from '@/components/profile-navigation';
import { ProfileSubpageOwner } from '@/components/profile-subpage-owner';
import { auth } from '@/lib/auth';
import { getDrinkEntries, getDrinkOverview, getRecentDrinkStores, type DrinkEntry } from '@/lib/drink-calendar';
import { addDays, birdLine, birdMood, cans, days, nextMilestone, isMonth, pluralRu, monthDays, monthSummary, monthTitle, monthWeeks, shiftMonth } from '@/lib/drink-calendar-fields';
import { formatPrice } from '@/lib/market-fields';
import { getProfileByUsername } from '@/lib/profile';
import { storeDrinkOptions } from '@/lib/store-catalog';

/**
 * A member's drink calendar. Rendered by /profile/[username]/calendar and, for the member's own calendar, by /calendar
 * itself: the tab bar opens it in one request, with no redirect to wait through (the redirect left the Android app on a
 * blank dark screen while the second page loaded).
 */
export async function DrinkCalendarScreen({ username, requested }: { username: string; requested?: string }) {
  const session = await auth.api.getSession({ headers: await headers() });
  const profile = await getProfileByUsername(username);
  if (!profile) notFound();
  const isOwn = session?.user.id === profile.id;
  const overview = await getDrinkOverview(profile.id);
  const current = overview.today.slice(0, 7);
  const month = isMonth(requested) && requested <= current ? requested : current;
  const list = monthDays(month);
  const [entries, options, stores] = await Promise.all([
    getDrinkEntries(profile.id, list[0]!, list.at(-1)!, isOwn, true),
    isOwn ? storeDrinkOptions() : [],
    isOwn ? getRecentDrinkStores(profile.id) : [],
  ]);
  const byDay: Record<string, DrinkEntry[]> = {};
  for (const entry of entries) (byDay[entry.day] ??= []).push(entry);
  const summary = monthSummary(entries);
  const topCover = summary.top ? entries.find(entry => entry.name === summary.top!.name && entry.cover)?.cover : undefined;
  const mood = birdMood(overview.current, overview.today);
  const streak = overview.current?.length ?? 0;
  const goal = nextMilestone(streak);
  const base = `/profile/${profile.username}/calendar`;
  const shareText = [`${monthTitle(month)} в календаре Canrush: ${cans(summary.cans)} за ${days(summary.days)}`,
    summary.top ? `любимый — ${summary.top.name}` : null,
    summary.priced ? `ушло ${formatPrice(summary.spent)}` : null,
    overview.best > 1 ? `рекордная серия — ${days(overview.best)}` : null].filter(Boolean).join(', ') + ' ⚡';

  return <BrandShell headerAction={<ProfileNavigation active={isOwn ? 'calendar' : 'profile'} />} surfaceClassName="profile-surface">
    <section className="community-directory drink-calendar-page" {...profileThemeAttributes(profile.profileAppearance?.theme)}>
      <ProfileBackButton href={isOwn ? '/profile' : `/profile/${profile.username}`} />
      <div className="profile-subpage-title"><h1>Календарь выпитого</h1>{!isOwn && <ProfileSubpageOwner profile={profile} />}</div>

      {/* «Отметить энергетик» links elsewhere lead to #add-drink: the page lands here, at the top, and the form opens. */}
      <div className="drink-banner" id="add-drink" data-mood={mood}>
        <DrinkBird mood={mood} size={56} />
        <div className="drink-banner-text">
          <BirdSpeech text={birdLine(mood, streak, isOwn)} />
          <dl className="drink-banner-stats">
            {streak ? <div data-stat="streak"><dt>Серия</dt><dd>{days(streak)}</dd></div> : <div data-stat="no-streak"><dt className="sr-only">Серия</dt><dd>Серии нет</dd></div>}
            <div><dt>Рекорд</dt><dd>{days(overview.best)}</dd></div>
            <div><dt>Всего</dt><dd>{cans(overview.total)}</dd></div>
          </dl>
          <div className="drink-banner-goal">
            <span>{streak
              ? <>До бонуса за {days(goal)} — ещё <b>{days(goal - streak)}</b>{overview.current?.end === overview.today ? '' : ', отметьте сегодня'}</>
              : isOwn ? 'Отметьте энергетик сегодня и завтра — начнётся серия' : 'Птица ждёт новую серию'}</span>
            <span className="drink-banner-bar" aria-hidden="true"><span style={{ width: `${Math.round(streak / goal * 100)}%` }} /></span>
          </div>
        </div>
        {isOwn && <DrinkLogForm options={options} stores={stores} today={overview.today} yesterday={addDays(overview.today, -1)} />}
      </div>

      <section className="community-panel drink-month-panel" aria-labelledby="drink-month-title">
        <nav className="drink-month-nav" aria-label="Месяцы">
          <h2 id="drink-month-title">{monthTitle(month)}</h2>
          <Link scroll={false} href={`${base}?month=${shiftMonth(month, -1)}`} aria-label="Предыдущий месяц">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg>
          </Link>
          {month < current ? <Link scroll={false} href={`${base}?month=${shiftMonth(month, 1)}`} aria-label="Следующий месяц">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
          </Link> : <span aria-hidden="true" />}
        </nav>
        <dl className="drink-month-metrics">
          <div><dt>Банок</dt><dd>{summary.cans}</dd></div>
          <div><dt>Дней</dt><dd>{summary.days}<span> из {list.length}</span></dd></div>
          {isOwn ? <div><dt>Расходы</dt><dd>{summary.priced ? formatPrice(summary.spent) : '—'}</dd></div>
            : <div><dt>Разных</dt><dd>{summary.unique}</dd></div>}
        </dl>
        <DrinkMonth key={month} weeks={monthWeeks(month)} entries={byDay} streaks={overview.streaks} today={overview.today} isOwn={isOwn} />
      </section>

      {summary.cans > 0 && <section className="community-panel drink-summary-card" aria-labelledby="drink-summary-title">
        <h2 id="drink-summary-title">Итог месяца</h2>
        {summary.top && <div className="drink-summary-top">
          {topCover ? <Image src={topCover} width={56} height={56} alt="" unoptimized={topCover.startsWith('/')} /> : <span className="drink-summary-bolt" aria-hidden="true">⚡</span>}
          <span><small>Чаще всего</small><strong>{summary.top.name}</strong></span>
          <b className="drink-summary-times">× {summary.top.count}</b>
        </div>}
        <ul className="drink-summary-pills">
          <li><b>{summary.unique}</b> {pluralRu(summary.unique, 'напиток', 'напитка', 'напитков')}</li>
          {isOwn && summary.priced > 0 && <li><b>{formatPrice(Math.round(summary.spent / summary.priced))}</b> за банку</li>}
          {overview.best > 1 && <li>рекорд <b>{days(overview.best)}</b></li>}
        </ul>
        {isOwn && summary.priced < summary.cans && <p className="drink-summary-note">Цена указана у {summary.priced} из {cans(summary.cans)}.</p>}
        {isOwn && <DrinkSummaryActions title="Мой месяц на Canrush" text={shareText} path={`${base}?month=${month}`} shot={{
          title: monthTitle(month), author: `@${profile.username} · календарь выпитого`, cans: summary.cans, days: summary.days, monthDays: list.length,
          unique: summary.unique, best: overview.best, top: summary.top, spent: summary.priced ? summary.spent : null, weeks: monthWeeks(month),
          counts: Object.fromEntries(list.map(day => [day, byDay[day]?.length ?? 0])), streakDays: list.filter(day => overview.streaks.some(item => item.length > 1 && item.start <= day && day <= item.end)),
        }} />}
      </section>}

    </section>
  </BrandShell>;
}
