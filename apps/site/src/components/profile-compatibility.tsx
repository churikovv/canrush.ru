import { Fragment } from 'react';
import Link from '@/components/navigation-progress';
import type { getProfileCompatibility } from '@/lib/profile-compatibility-data';

function CriterionIcon({ index }: { index: number }) {
  const paths = [
    <path key="heart" d="M20.5 5.5a5 5 0 0 0-7 0L12 7l-1.5-1.5a5 5 0 0 0-7 7L12 21l8.5-8.5a5 5 0 0 0 0-7Z"/>,
    <Fragment key="brand"><path d="M3 4h8l10 10-7 7L3 10Z"/><circle cx="7" cy="8" r="1"/></Fragment>,
    <Fragment key="taste"><path d="M12 4c-2 4-7 8-7 12a7 7 0 0 0 14 0c0-4-5-8-7-12Z"/><path d="M9 16a3 3 0 0 0 3 3"/></Fragment>,
    <path key="star" d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>,
    <Fragment key="design"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="m4 15 5-5 4 4 3-3 4 4"/><circle cx="15" cy="8" r="1"/></Fragment>,
  ];
  return <svg className="compatibility-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[index]}</svg>;
}

const labels = ['Избранное', 'Бренды', 'Вкусы', 'Оценки вкуса', 'Дизайн'];

const CX = 160, CY = 122, R = 80;
const round = (value: number) => Math.round(value * 10) / 10;
/** A point `share` of the way out on the axis of criterion `index` (the first axis points up). */
const point = (index: number, count: number, share: number) => {
  const angle = (index / count) * 2 * Math.PI;
  return { x: round(CX + R * share * Math.sin(angle)), y: round(CY - R * share * Math.cos(angle)) };
};

/** Radar of the criteria: rings at 25–100%, one axis each, the shape of the scores; a criterion without data sits at the centre with a hollow dot. */
function CompatibilityRadar({ parts }: { parts: { label: string; score: number | null }[] }) {
  const count = parts.length;
  const shape = parts.map((part, index) => point(index, count, (part.score ?? 0) / 100));
  return <svg viewBox="0 0 320 240" className="compatibility-radar">
    {[0.25, 0.5, 0.75, 1].map(ring => <circle key={ring} className="compatibility-radar-ring" cx={CX} cy={CY} r={R * ring} />)}
    {parts.map((part, index) => { const end = point(index, count, 1); return <line key={part.label} className="compatibility-radar-axis" x1={CX} y1={CY} x2={end.x} y2={end.y} />; })}
    <polygon className="compatibility-radar-shape" points={shape.map(item => `${item.x},${item.y}`).join(' ')} />
    {shape.map((item, index) => <circle key={parts[index]!.label} className={parts[index]!.score === null ? 'compatibility-radar-dot is-unavailable' : 'compatibility-radar-dot'} cx={item.x} cy={item.y} r="4" />)}
    {parts.map((part, index) => {
      const at = point(index, count, 1.18);
      const anchor = Math.abs(at.x - CX) < 4 ? 'middle' : at.x > CX ? 'start' : 'end';
      return <text key={part.label} x={at.x} y={at.y} textAnchor={anchor} dominantBaseline={at.y < CY - R / 2 ? 'auto' : at.y > CY + R / 2 ? 'hanging' : 'middle'}
        className={part.score === null ? 'is-unavailable' : undefined}>{labels[index]}</text>;
    })}
  </svg>;
}

type Compatibility = Awaited<ReturnType<typeof getProfileCompatibility>>;
/** Favorites each side needs, or shared rated drinks, before anything is compared (`profileCompatibility`). */
const NEEDED = 3;

function Step({ label, count }: { label: string; count: number }) {
  const done = count >= NEEDED;
  return <li className="compatibility-step" data-done={done || undefined}>
    <span className="compatibility-step-head"><span>{label}</span><b>{Math.min(count, NEEDED)} / {NEEDED}</b></span>
    <span className="compatibility-step-bar"><span style={{ width: `${(Math.min(count, NEEDED) / NEEDED) * 100}%` }} /></span>
  </li>;
}

/** Instead of an empty chart: what is missing for a comparison, as two ways with progress, and where to go to add it. */
function CompatibilityEmpty({ value, username }: { value: Compatibility; username: string }) {
  const [mine = 0, theirs = 0] = value.favoriteCounts;
  const viewerShort = mine < NEEDED;
  return <div className="compatibility-empty-card">
    <span className="compatibility-empty-art" aria-hidden="true">
      <svg width="64" height="40" viewBox="0 0 64 40"><circle cx="22" cy="20" r="17" /><circle cx="42" cy="20" r="17" /><path d="M32 10.4a17 17 0 0 1 0 19.2 17 17 0 0 1 0-19.2Z" /></svg>
    </span>
    <strong>Пока не с чем сравнить</strong>
    <p>Совместимость считается по избранному и оценкам. Подойдёт любой из двух путей:</p>
    <ol className="compatibility-steps">
      <li className="compatibility-way"><span className="compatibility-way-title">По избранному</span><ul>
        <Step label="У вас" count={mine} />
        <Step label={`У @${username}`} count={theirs} />
      </ul></li>
      <li className="compatibility-or" aria-hidden="true"><span>или</span></li>
      <li className="compatibility-way"><span className="compatibility-way-title">По оценкам</span><ul>
        <Step label="Общие напитки с отзывами" count={value.sharedReviews} />
      </ul></li>
    </ol>
    {viewerShort || value.sharedReviews < NEEDED
      ? <Link className="compatibility-empty-cta" href={viewerShort ? '/catalog' : `/profile/${username}/reviews`}>{viewerShort ? 'Выбрать напитки в каталоге' : `Оценить напитки @${username}`}</Link>
      : null}
  </div>;
}

export function ProfileCompatibility({ value, username }: { value: Compatibility; username: string }) {
  if (value.score === null) return <section className="profile-compatibility" aria-labelledby="compatibility-title">
    <header className="compatibility-heading"><h2 id="compatibility-title">Совместимость с вами</h2></header>
    <CompatibilityEmpty value={value} username={username} />
  </section>;
  return <section className="profile-compatibility" aria-labelledby="compatibility-title">
    <header className="compatibility-heading"><h2 id="compatibility-title">Совместимость с вами</h2>
      <div className="compatibility-total"><strong className="compatibility-score">{value.score === null ? '—' : <>{value.score}<span>%</span></>}</strong>
        {value.trend.delta !== null ? <p className="compatibility-trend" data-direction={value.trend.delta>0?'up':value.trend.delta<0?'down':'equal'}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={value.trend.delta>0?'M12 20V4m-6 6 6-6 6 6':value.trend.delta<0?'M12 4v16m-6-6 6 6 6-6':'M4 12h16m-6-6 6 6-6 6'}/></svg>
          <span>{value.trend.delta===0?'Без изменений':`${value.trend.delta>0?'+':''}${value.trend.delta} п.п.`}<small>за месяц</small></span>
        </p> : <p>{value.score===null?'Пока мало данных':value.trend.reason==='criteria'?'Изменились критерии сравнения':'История за месяц ещё собирается'}</p>}</div>
    </header>
    <div className="compatibility-chart" aria-hidden="true"><CompatibilityRadar parts={value.parts} /></div>
    <dl className="compatibility-parts">{value.parts.map((part, index) => <div key={part.label}>
      <dt><CriterionIcon index={index}/><span title={part.label}>{labels[index]}</span></dt>
      <dd>{part.score === null ? <span className="compatibility-unavailable">Мало данных</span> : `${Math.round(part.score)}%`}</dd>
    </div>)}</dl>
    <dl className="compatibility-counts"><div><dd><CriterionIcon index={0}/>{value.common}</dd><dt>Общих избранных</dt></div><div><dd><CriterionIcon index={3}/>{value.sharedReviews}</dd><dt>Напитков с оценками у обоих</dt></div></dl>
  </section>;
}
