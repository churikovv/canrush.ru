import Image from 'next/image';

/** Icon resolved on the server: a manifest or handcrafted logo, or nothing for initials. */
export interface RetailerAsset { src: string; size: number; tile?: boolean }

function initials(name: string): string {
  const words = name.match(/[a-zа-яё0-9]+/giu) ?? [];
  if (words.length === 0) return '•';
  if (words.length === 1) return words[0]!.slice(0, 2).toLocaleUpperCase('ru-RU');
  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toLocaleUpperCase('ru-RU');
}

/** Badge markup shared by the server badge and client widgets that receive assets from a server action. */
export function RetailerBadgeView({ name, asset, size = 'small', decorative = false }: { name: string; asset: RetailerAsset | null; size?: 'small' | 'large'; decorative?: boolean }) {
  const accessibility = decorative ? { 'aria-hidden': true as const } : { role: 'img', 'aria-label': `Магазин ${name}` };
  const className = `retailer-badge retailer-badge-${size}${asset?.tile ? ' retailer-badge-tile' : ''}`;
  return (
    <span className={className} title={name} {...accessibility}>
      {asset ? <Image src={asset.src} width={asset.size} height={asset.size} alt="" /> : <span>{initials(name)}</span>}
    </span>
  );
}
