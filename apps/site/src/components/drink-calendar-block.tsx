import Link from '@/components/navigation-progress';
import { DrinkBird } from '@/components/drink-bird';
import { DrinkHeatmap } from '@/components/drink-heatmap';
import { getDrinkEntries, getDrinkOverview } from '@/lib/drink-calendar';
import { birdLine, birdMood, cans, days, heatmapWeeks } from '@/lib/drink-calendar-fields';

const WEEKS = 53;

/** Profile block: mascot, streak numbers and the last year of cans. */
export async function DrinkCalendarBlock({ userId, username, isOwn }: { userId: string; username: string; isOwn: boolean }) {
  const overview = await getDrinkOverview(userId);
  const weeks = heatmapWeeks(overview.today, WEEKS);
  const from = weeks[0]!.find(Boolean)!;
  const entries = await getDrinkEntries(userId, from, overview.today, false);
  const drinks: Record<string, string[]> = {};
  for (const entry of entries) (drinks[entry.day] ??= []).push(entry.name);
  const yearTotal = entries.length;
  const mood = birdMood(overview.current, overview.today);
  const streak = overview.current?.length ?? 0;
  const href = `/profile/${username}/calendar`;
  return <section className="community-panel drink-calendar-block" aria-labelledby="drink-calendar-title">
    <div className="community-section-heading"><h2 id="drink-calendar-title">Календарь выпитого</h2><Link href={href}>Открыть ↗</Link></div>
    <div className="drink-calendar-hero">
      <DrinkBird mood={mood} size={84} />
      <div className="drink-calendar-hero-text">
        <p className="drink-bird-speech">{birdLine(mood, streak, isOwn)}</p>
        <dl className="drink-streak-stats">
          <div data-stat="streak"><dt>Серия</dt><dd>{days(streak)}</dd></div>
          <div><dt>Рекорд</dt><dd>{days(overview.best)}</dd></div>
          <div><dt>За год</dt><dd>{cans(yearTotal)}</dd></div>
        </dl>
      </div>
    </div>
    <DrinkHeatmap weeks={weeks} counts={overview.dayCounts} drinks={drinks} label={`За последний год: ${cans(yearTotal)}, рекордная серия — ${days(overview.best)}.`} />
    {isOwn && <div className="drink-calendar-actions"><Link className="community-button" href={`${href}#add-drink`}>Отметить энергетик</Link></div>}
  </section>;
}
