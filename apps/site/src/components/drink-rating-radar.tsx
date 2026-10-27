import { countryFlag, countryName } from '@/lib/countries';
import type { DrinkRadar } from '@/lib/score-profile';

const AXES: { key: keyof DrinkRadar; label: string; scale: number; unit: string }[] = [
  { key: 'taste', label: 'Вкус', scale: 10, unit: '' },
  { key: 'design', label: 'Дизайн', scale: 10, unit: '' },
  { key: 'overall', label: 'В среднем', scale: 10, unit: '' },
  { key: 'favorite', label: 'Избранное', scale: 100, unit: '%' },
  { key: 'country', label: 'Страна', scale: 100, unit: '%' },
];
const CX = 150, CY = 110, R = 72;
const round = (value: number) => Math.round(value * 10) / 10;
const point = (index: number, share: number) => {
  const angle = (index / AXES.length) * 2 * Math.PI;
  return { x: round(CX + R * share * Math.sin(angle)), y: round(CY - R * share * Math.cos(angle)) };
};
const shape = (values: DrinkRadar) => AXES.map((axis, index) => point(index, Math.min(1, Math.max(0, (values[axis.key] ?? 0) / axis.scale))));
const polygon = (points: { x: number; y: number }[]) => points.map(item => `${item.x},${item.y}`).join(' ');
const value = (axis: (typeof AXES)[number], values: DrinkRadar) => {
  const raw = values[axis.key];
  return raw === null ? '—' : axis.unit ? `${raw}${axis.unit}` : raw.toFixed(1);
};

/**
 * The rating card's radar: this drink's taste, design, their average and how many keep it in favourites, against the
 * catalog average (dashed), with each value at its axis; the «Страна» axis is labelled with the flag of the country reviews name most often
 * and shows the share of reviews naming it.
 */
export function DrinkRatingRadar({ drink, catalog, country }: { drink: DrinkRadar; catalog: DrinkRadar; country: string | null }) {
  const mine = shape(drink), all = shape(catalog);
  const name = countryName(country);
  return <div className="drink-radar">
    <svg viewBox="-40 12 380 196" className="drink-radar-chart" role="img"
      aria-label={`Оценки напитка: ${AXES.map(axis => `${axis.label} ${value(axis, drink)}`).join(', ')}; пунктир — среднее по каталогу${name ? `; чаще всего указывают страну ${name}` : ''}`}>
      {[0.25, 0.5, 0.75, 1].map(ring => <polygon key={ring} className="drink-radar-ring" points={polygon(AXES.map((_, index) => point(index, ring)))} />)}
      {AXES.map((axis, index) => { const end = point(index, 1); return <line key={axis.key} className="drink-radar-ring" x1={CX} y1={CY} x2={end.x} y2={end.y} />; })}
      <polygon className="drink-radar-shape is-catalog" points={polygon(all)} />
      <polygon className="drink-radar-shape" points={polygon(mine)} />
      {AXES.map((axis, index) => <circle key={axis.key} className="drink-radar-dot" cx={mine[index]!.x} cy={mine[index]!.y} r="3.5" />)}
      {AXES.map((axis, index) => {
        const at = point(index, 1.24);
        const anchor = Math.abs(at.x - CX) < 4 ? 'middle' : at.x > CX ? 'start' : 'end';
        return <text key={axis.key} x={at.x} y={at.y} textAnchor={anchor} dominantBaseline={at.y < CY - R / 2 ? 'auto' : at.y > CY + R / 2 ? 'hanging' : 'middle'}>
          {axis.key === 'country' && country ? <><tspan className="drink-radar-flag">{countryFlag(country)}{'\u00a0'}</tspan><title>{`${name}: доля отзывов с этой страной`}</title></> : axis.label} <tspan className="drink-radar-value">{value(axis, drink)}</tspan>
        </text>;
      })}
    </svg>
    <p className="drink-radar-key"><span><span className="drink-radar-swatch" />Этот напиток</span><span><span className="drink-radar-swatch is-catalog" />В каталоге</span></p>
  </div>;
}
