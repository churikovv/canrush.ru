import '@/styles/shared.css';
import '@/styles/inventory.css';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { CardInventory, type InventoryCard } from '@/components/card-inventory';
import { auth } from '@/lib/auth';
import { getAlbum } from '@/lib/gacha';
import { getProfileByUsername } from '@/lib/profile';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Коллекция карточек', robots: { index: false, follow: false } };

/**
 * The Bankomat inventory, a game screen of its own like the season pass: no site header or tab bar, the way out is a
 * button on the screen. Missing cans go to the owner only, with their craft price; their flavour stays a surprise.
 */
export default async function GachaAlbumPage({ params }: { params: Promise<{ username: string }> }) {
  const [{ username }, session] = await Promise.all([params, auth.api.getSession({ headers: await headers() })]);
  const profile = await getProfileByUsername(username);
  if (!profile) notFound();
  const isOwn = session?.user.id === profile.id;
  const album = await getAlbum(profile.id);
  const cards: InventoryCard[] = album.brands.flatMap(brand => brand.cards)
    .filter(card => card.owned || isOwn)
    .map(({ brand, flavor, name, cover, href, rarity, count, owned, cost }) => owned
      ? { brand, flavor, name, cover, href, rarity, count, owned, cost }
      // A missing can keeps its brand and price only: the name, cover and flavour would spoil the surprise.
      : { brand, flavor, name: '', cover: '', href: '', rarity, count: 0, owned, cost });
  return <CardInventory cards={cards} isOwn={isOwn} shards={album.shards} owner={`@${profile.username}`} backHref={isOwn ? '/profile' : `/profile/${profile.username}`} />;
}
