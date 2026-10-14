import type { CSSProperties } from 'react';
import { ProfileStatFill } from '@/components/profile-stat-fill';
import type { ProfileRatings } from '@/lib/profile-community';

const formatScore = (value: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(value);

function criticStyle(overall: number) {
  if (overall >= 8.5) return 'Щедрый критик';
  if (overall >= 7) return 'Доброжелательный критик';
  if (overall >= 5) return 'Взвешенный критик';
  return 'Строгий критик';
}

function reviewsWord(count: number) {
  const tens = count % 100, ones = count % 10;
  if (tens >= 11 && tens <= 14) return 'отзывам';
  return ones === 1 ? 'отзыву' : 'отзывам';
}

export function ProfileRatingStats({ ratings }: { ratings: ProfileRatings }) {
  const columns = [...ratings.histogram].sort((a, b) => a.score - b.score);
  const peak = Math.max(...columns.map(row => row.count));
  const rated = columns.filter(row => row.count > 0);
  const lowest = rated[0]?.score;
  const highest = rated.at(-1)?.score;
  return <div className="profile-rating-summary">
    <div className="profile-rating-overview">
      <div className="profile-rating-headline">
        <div className="profile-rating-gauge" style={{ '--score': ratings.overall / 10 } as CSSProperties} role="img" aria-label={`Средняя оценка ${formatScore(ratings.overall)} из 10`}>
          <strong aria-hidden="true">{formatScore(ratings.overall)}</strong><span aria-hidden="true">из 10</span>
        </div>
        <div className="profile-rating-persona"><strong>{criticStyle(ratings.overall)}</strong><span>Средняя по {ratings.count} {reviewsWord(ratings.count)}</span></div>
      </div>
      <dl className="profile-rating-axes">
        {([['Дизайн', ratings.design], ['Вкус', ratings.taste]] as const).map(([label, value]) => <div key={label}>
          <dt>{label}</dt><dd>{formatScore(value)}<span> / 10</span></dd>
          <span className="profile-rating-meter" aria-hidden="true"><ProfileStatFill value={value / 10} /></span>
        </div>)}
      </dl>
    </div>
    <figure className="profile-rating-chart">
      <div className="profile-rating-bars" role="img" aria-label={`Распределение оценок: ${columns.map(row => `${row.score} баллов: ${row.count}`).join(', ')}. Общая оценка отзыва округлена до целого.`}>
        {columns.map((row, index) => <div key={row.score} className="profile-rating-bar" data-empty={row.count === 0 || undefined} data-peak={(row.count > 0 && row.count === peak) || undefined}>
          <b>{row.count || ''}</b>
          <span className="profile-rating-column"><ProfileStatFill axis="y" value={peak ? row.count / peak : 0} delay={index * 30} /></span>
          <small>{row.score}</small>
        </div>)}
      </div>
      <figcaption className="profile-rating-facts">
        <span>Оценок <b>{ratings.count}</b></span>
        {highest !== undefined && <span>Высшая <b>{highest}</b></span>}
        {lowest !== undefined && <span>Низшая <b>{lowest}</b></span>}
      </figcaption>
    </figure>
  </div>;
}
