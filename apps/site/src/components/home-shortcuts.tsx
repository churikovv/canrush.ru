import Image from 'next/image';
import Link from '@/components/navigation-progress';

/** Avito-style section tiles right after the first screen: a label on top, the section's character in the corner. */
const SHORTCUTS = [
  { href: '/market/stores', label: 'Магазины', image: '/brand/achievements/seller.png' },
  { href: '/prices', label: 'Цены', image: '/brand/achievements/flash.png' },
  { href: '/tierlists', label: 'Тирлисты', image: '/brand/achievements/top.png' },
  { href: '/market', label: 'Маркет', image: '/brand/achievements/collector.png' },
] as const;

export function HomeShortcuts() {
  return <nav className="home-shortcuts" aria-label="Разделы">
    {SHORTCUTS.map(item => <Link key={item.href} className="home-shortcut" href={item.href}>
      <span>{item.label}</span>
      <Image src={item.image} width={120} height={120} sizes="120px" alt="" />
    </Link>)}
  </nav>;
}
