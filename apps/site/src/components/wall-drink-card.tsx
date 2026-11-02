import Image from 'next/image';
import Link from '@/components/navigation-progress';
import type { WallDrink } from '@/lib/wall-drink-fields';

/** A catalog drink under a wall record or a comment: cover, name and a link to its page (none once it left the catalog). */
export function WallDrinkCard({ drink, compact = false }: { drink: WallDrink; compact?: boolean }) {
  const body = <>
    {drink.cover ? <Image src={drink.cover} width={56} height={56} sizes="56px" alt="" unoptimized={drink.cover.startsWith('/')} /> : <span className="wall-drink-bolt" aria-hidden="true">⚡</span>}
    <span><small>Напиток</small><b>{drink.label}</b></span>
    {drink.href && <span className="wall-drink-arrow" aria-hidden="true">→</span>}
  </>;
  return drink.href
    ? <Link className="wall-drink" data-compact={compact || undefined} href={drink.href}>{body}</Link>
    : <span className="wall-drink" data-compact={compact || undefined}>{body}</span>;
}
