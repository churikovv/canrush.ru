import { Fragment } from 'react';
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

export function ProfileCompatibility({ value }: { value: Awaited<ReturnType<typeof getProfileCompatibility>> }) {
  return <section className="profile-compatibility" aria-labelledby="compatibility-title">
    <header className="compatibility-heading"><h2 id="compatibility-title">Совместимость с вами</h2>
      <div className="compatibility-total"><strong className="compatibility-score">{value.score === null ? '—' : <>{value.score}<span>%</span></>}</strong>
        {value.trend.delta !== null ? <p className="compatibility-trend" data-direction={value.trend.delta>0?'up':value.trend.delta<0?'down':'equal'}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={value.trend.delta>0?'M12 20V4m-6 6 6-6 6 6':value.trend.delta<0?'M12 4v16m-6-6 6 6 6-6':'M4 12h16m-6-6 6 6-6 6'}/></svg>
          <span>{value.trend.delta===0?'Без изменений':`${value.trend.delta>0?'+':''}${value.trend.delta} п.п.`}<small>за месяц</small></span>
        </p> : <p>{value.score===null?'Пока мало данных':value.trend.reason==='criteria'?'Изменились критерии сравнения':'История за месяц ещё собирается'}</p>}</div>
    </header>
    <div className="compatibility-chart" aria-hidden="true">
      <svg viewBox="0 0 260 114" className="compatibility-dot-chart">
        {value.parts.flatMap((part, index) => Array.from({ length: 5 }, (_, column) => {
          // Five dot columns per criterion. Height represents that criterion's score.
          const height = part.score === null ? 0 : Math.round(part.score / 10);
          return Array.from({ length: Math.max(1,height) }, (_, row) => <circle
            key={`${index}:${column}:${row}`} cx={8+(index*5+column)*10} cy={96-row*9} r="1.9"
            className={part.score === null ? 'is-unavailable' : column===2 ? 'is-accent' : undefined}/>);
        }))}
        {value.parts.map((part,index)=><text key={part.label} x={28+index*50} y="113" textAnchor="middle">{index+1}</text>)}
      </svg>
    </div>
    <dl className="compatibility-parts">{value.parts.map((part, index) => <div key={part.label}>
      <dt><CriterionIcon index={index}/><span title={part.label}>{labels[index]}</span></dt>
      <dd>{part.score === null ? <span className="compatibility-unavailable">Мало данных</span> : `${Math.round(part.score)}%`}</dd>
    </div>)}</dl>
    <dl className="compatibility-counts"><div><dd><CriterionIcon index={0}/>{value.common}</dd><dt>Общих избранных</dt></div><div><dd><CriterionIcon index={3}/>{value.sharedReviews}</dd><dt>Напитков с оценками у обоих</dt></div></dl>
    {value.score === null && <p className="compatibility-empty">Добавьте хотя бы по три напитка в избранное или оцените три одинаковых напитка, чтобы сравнить предпочтения.</p>}
  </section>;
}
