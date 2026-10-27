import type { ScoreProfile } from '@/lib/score-profile';

const AXES: { key: keyof ScoreProfile; label: string; hint: string }[] = [
  { key: 'taste', label: 'Вкус', hint: 'средняя оценка вкуса ×10' },
  { key: 'design', label: 'Дизайн', hint: 'средняя оценка дизайна ×10' },
  { key: 'high', label: 'Оценки 8+', hint: 'доля отзывов со средней оценкой от 8' },
  { key: 'liked', label: 'Лайки', hint: 'доля свайпов вправо в дейтинге' },
  { key: 'returning', label: 'Возвращаются', hint: 'доля отметивших в календаре, кто взял банку ещё раз' },
];
const CX = 170, CY = 128, R = 84;
const round = (value: number) => Math.round(value * 10) / 10;
/** A point `share` of the way out on axis `index` (the first axis points up); rounded so server and browser agree. */
const point = (index: number, share: number) => {
  const angle = (index / AXES.length) * 2 * Math.PI;
  return { x: round(CX + R * share * Math.sin(angle)), y: round(CY - R * share * Math.cos(angle)) };
};
const shape = (profile: ScoreProfile) => AXES.map(axis => Math.min(100, Math.max(0, profile[axis.key] ?? 0)) / 100).map((share, index) => point(index, share));
const polygon = (points: { x: number; y: number }[]) => points.map(item => `${item.x},${item.y}`).join(' ');

/**
 * «Профиль оценок»: some drinks (`label` — «Ваши напитки», «Этот напиток») against the catalog average on five 0–100
 * axes, like the compatibility radar on profiles. An axis without data stays at the centre with a hollow dot; the
 * legend lists the exact numbers. Styles — `.score-radar*` in shared.css.
 */
export function ScoreRadar({ yours, catalog, label }: { yours: ScoreProfile; catalog: ScoreProfile; label: string }) {
  const mine = shape(yours), all = shape(catalog);
  return <div className="score-radar">
    <svg viewBox="0 0 340 250" className="score-radar-chart" role="img" aria-label={`Профиль оценок: ${label.toLowerCase()} и среднее по каталогу`}>
      {[0.25, 0.5, 0.75, 1].map(ring => <polygon key={ring} className="score-radar-ring" points={polygon(AXES.map((_, index) => point(index, ring)))} />)}
      {AXES.map((axis, index) => { const end = point(index, 1); return <line key={axis.key} className="score-radar-axis" x1={CX} y1={CY} x2={end.x} y2={end.y} />; })}
      <polygon className="score-radar-shape is-catalog" points={polygon(all)} />
      <polygon className="score-radar-shape" points={polygon(mine)} />
      {AXES.map((axis, index) => <circle key={axis.key} className={yours[axis.key] === null ? 'score-radar-dot is-empty' : 'score-radar-dot'} cx={mine[index]!.x} cy={mine[index]!.y} r="4" />)}
      {AXES.map((axis, index) => {
        const at = point(index, 1.2);
        const anchor = Math.abs(at.x - CX) < 4 ? 'middle' : at.x > CX ? 'start' : 'end';
        return <text key={axis.key} x={at.x} y={at.y} textAnchor={anchor} dominantBaseline={at.y < CY - R / 2 ? 'auto' : at.y > CY + R / 2 ? 'hanging' : 'middle'}>{axis.label}</text>;
      })}
    </svg>
    <ul className="score-radar-legend">
      <li className="score-radar-key"><span className="score-radar-swatch" /> {label} <span className="score-radar-swatch is-catalog" /> Среднее по каталогу</li>
      {AXES.map(axis => <li key={axis.key} title={axis.hint}><span>{axis.label}</span><b>{yours[axis.key] ?? '—'}</b><small>{catalog[axis.key] ?? '—'}</small></li>)}
    </ul>
  </div>;
}
