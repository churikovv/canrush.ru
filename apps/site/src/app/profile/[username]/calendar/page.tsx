import '@/styles/shared.css';
import '@/styles/profile.css';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import Link from '@/components/navigation-progress';
import { BrandShell } from '@/components/brand-shell';
import { DrinkBird } from '@/components/drink-bird';
import { DrinkLogForm } from '@/components/drink-log-form';
import { DrinkMonth } from '@/components/drink-month';
import { DrinkShareButton } from '@/components/drink-share-button';
import { ProfileBackButton } from '@/components/profile-back-button';
import { ProfileNavigation } from '@/components/profile-navigation';
import { displayName } from '@/components/wall-post';
import { auth } from '@/lib/auth';
import { getDrinkEntries, getDrinkOverview, getRecentDrinkStores, type DrinkEntry } from '@/lib/drink-calendar';
import { addDays, birdLine, birdMood, cans, dayTitle, days, isMonth, monthDays, monthSummary, monthTitle, monthWeeks, shiftMonth } from '@/lib/drink-calendar-fields';
import { formatPrice } from '@/lib/market-fields';
import { getProfileByUsername } from '@/lib/profile';
import { storeDrinkOptions } from '@/lib/store-catalog';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Календарь выпитого', robots: { index: false, follow: false } };

export default async function DrinkCalendarPage({ params, searchParams }: { params: Promise<{ username: string }>; searchParams: Promise<{ month?: string }> }) {
  const [{ username }, { month: requested }, session] = await Promise.all([params, searchParams, auth.api.getSession({ headers: await headers() })]);
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
  const mood = birdMood(overview.current, overview.today);
  const streak = overview.current?.length ?? 0;
  const base = `/profile/${profile.username}/calendar`;
  const series = overview.streaks.filter(item => item.length > 1).slice(-8).reverse();
  const shareText = [`${monthTitle(month)} в календаре Canrush: ${cans(summary.cans)} за ${days(summary.days)}`,
    summary.top ? `любимый — ${summary.top.name}` : null,
    summary.priced ? `ушло ${formatPrice(summary.spent)}` : null,
    overview.best > 1 ? `рекордная серия — ${days(overview.best)}` : null].filter(Boolean).join(', ') + ' ⚡';

  return <BrandShell headerAction={<ProfileNavigation active="profile" />} surfaceClassName="profile-surface">
    <section className="community-directory drink-calendar-page" data-profile-theme={profile.profileAppearance?.theme ?? 'default'}>
      <ProfileBackButton href={isOwn ? '/profile' : `/profile/${profile.username}`} />
      <h1>Календарь выпитого{!isOwn && <span className="community-muted"> · {displayName(profile)}</span>}</h1>

      <div className="community-panel drink-calendar-hero is-large">
        <DrinkBird mood={mood} size={120} />
        <div className="drink-calendar-hero-text">
          <p className="drink-bird-speech">{birdLine(mood, streak, isOwn)}</p>
          <dl className="drink-streak-stats">
            <div data-stat="streak"><dt>Серия</dt><dd>{days(streak)}</dd></div>
            <div><dt>Рекорд</dt><dd>{days(overview.best)}</dd></div>
            <div><dt>Всего</dt><dd>{cans(overview.total)}</dd></div>
          </dl>
        </div>
      </div>

      {isOwn && <section className="community-panel" id="add-drink" aria-labelledby="add-drink-title">
        <div className="community-section-heading"><h2 id="add-drink-title">Отметить энергетик</h2></div>
        <p className="community-section-note">За каждый день с отметкой — опыт, за серии 3, 7, 14 и 30 дней — бонус и теги. Цену и магазин видите только вы.</p>
        <DrinkLogForm options={options} stores={stores} today={overview.today} yesterday={addDays(overview.today, -1)} />
      </section>}

      <section className="community-panel" aria-labelledby="drink-month-title">
        <nav className="drink-month-nav" aria-label="Месяцы">
          <Link href={`${base}?month=${shiftMonth(month, -1)}`} aria-label="Предыдущий месяц">←</Link>
          <h2 id="drink-month-title">{monthTitle(month)}</h2>
          {month < current ? <Link href={`${base}?month=${shiftMonth(month, 1)}`} aria-label="Следующий месяц">→</Link> : <span aria-hidden="true" />}
        </nav>
        <DrinkMonth key={month} weeks={monthWeeks(month)} entries={byDay} streaks={overview.streaks} today={overview.today} isOwn={isOwn} />
      </section>

      <section className="community-panel" aria-labelledby="drink-summary-title">
        <div className="community-section-heading"><h2 id="drink-summary-title">Итог месяца</h2></div>
        {summary.cans ? <>
          <dl className="drink-summary">
            <div><dt>Банок</dt><dd>{summary.cans}</dd></div>
            <div><dt>Дней с энергетиком</dt><dd>{summary.days} из {list.length}</dd></div>
            <div><dt>Разных напитков</dt><dd>{summary.unique}</dd></div>
            {summary.top && <div className="is-wide"><dt>Чаще всего</dt><dd>{summary.top.name} <span>× {summary.top.count}</span></dd></div>}
            {isOwn && <div className="is-accent"><dt>Потрачено за месяц</dt><dd>{summary.priced ? formatPrice(summary.spent) : '—'}</dd></div>}
            {isOwn && summary.priced > 0 && <div><dt>Средняя банка</dt><dd>{formatPrice(Math.round(summary.spent / summary.priced))}</dd></div>}
          </dl>
          {isOwn && summary.priced < summary.cans && <p className="community-muted drink-summary-note">Цена указана у {summary.priced} из {cans(summary.cans)}.</p>}
          {isOwn && <DrinkShareButton title="Мой месяц на Canrush" text={shareText} path={`${base}?month=${month}`} />}
        </> : <p className="community-empty">В этом месяце отметок нет.</p>}
      </section>

      <section className="community-panel" aria-labelledby="drink-series-title">
        <div className="community-section-heading"><h2 id="drink-series-title">Серии</h2></div>
        {series.length ? <ol className="drink-series">{series.map(item => <li key={item.start} className={item === overview.current ? 'is-current' : undefined}>
          <span className="drink-series-flame" aria-hidden="true" data-length={item.length >= 30 ? 30 : item.length >= 14 ? 14 : item.length >= 7 ? 7 : 0} />
          <strong>{days(item.length)}</strong>
          <span>{dayTitle(item.start)} — {dayTitle(item.end)} {item.start.slice(0, 4)}</span>
          {item === overview.current && <em>идёт сейчас</em>}
        </li>)}</ol> : <p className="community-empty">Серий пока нет: отмечайте энергетик два дня подряд.</p>}
      </section>
    </section>
  </BrandShell>;
}
