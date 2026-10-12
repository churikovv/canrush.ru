import type { profileCompatibility } from '@/lib/profile-compatibility';

export function ProfileCompatibility({ value }: { value: ReturnType<typeof profileCompatibility> }) {
  return <section className="profile-compatibility" aria-labelledby="compatibility-title">
    <div className="compatibility-heading"><div><h2 id="compatibility-title">Совместимость с вами</h2><p>{value.score === null ? 'Пока мало данных для сравнения' : value.confidence}</p></div>{value.score !== null && <strong className="compatibility-score">{value.score}%</strong>}</div>
    {value.score === null ? <p>Добавьте хотя бы по три напитка в избранное или оцените три одинаковых напитка — тогда появится процент совместимости.</p> : <>
      <p>Общих избранных: {value.common} · Напитков с оценками у обоих: {value.sharedReviews}</p>
      <details><summary>Из чего складывается процент</summary><dl>{value.parts.map(part => <div key={part.label}><dt>{part.label}</dt><dd>{part.score === null ? 'Мало данных' : `${Math.round(part.score)}%`}</dd></div>)}</dl>
      </details>
    </>}
  </section>;
}
