import Image from 'next/image';
import Link from '@/components/navigation-progress';
import { XP_SOURCES } from '@/lib/xp-sources';

/** Конец рейтинга: за что дают опыт, каждая плитка ведёт туда, где это делается. */
export function XpGuide() {
  return <section className="xp-guide" aria-labelledby="xp-guide-title">
    <h2 id="xp-guide-title">За что дают опыт</h2>
    <p>Опыт поднимает уровень, двигает в гонке недели и открывает награды пропуска.</p>
    <ul>{XP_SOURCES.map(source => <li key={source.reason}><Link className="can-plate xp-tile" href={source.href}>
      <Image src={source.art} width={120} height={120} sizes="44px" alt="" />
      <span className="xp-tile-amount">{source.upTo ? 'до ' : ''}+{source.points} XP</span>
      <b>{source.title}</b>
      <small>{source.note}</small>
    </Link></li>)}</ul>
  </section>;
}
