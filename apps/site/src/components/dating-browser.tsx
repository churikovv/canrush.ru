import { headers } from 'next/headers';
import Image from 'next/image';
import Link from '@/components/navigation-progress';
import { SwipeDeck } from '@/components/swipe-deck';
import { auth } from '@/lib/auth';
import { loadCatalogSnapshot } from '@/lib/catalog';
import { datingRewards, getDatingProgress, getLikedSwipes, getSwipeDeck } from '@/lib/drink-swipes';

/**
 * «Дейтинг» in the community: a deck of drinks to swipe right («нравится») or left («пропустить»). Signed in, the
 * recommender's picks come first and every swipe feeds «Тебе понравится» and the counts on the drink page.
 */
export async function DatingBrowser() {
  const [session, { groups }] = await Promise.all([auth.api.getSession({ headers: await headers() }), loadCatalogSnapshot()]);
  const viewerId = session?.user.id ?? null;
  const [deck, liked, progress] = await Promise.all([getSwipeDeck(viewerId, groups), viewerId ? getLikedSwipes(viewerId, groups) : [], viewerId ? getDatingProgress(viewerId) : null]);
  return <div className="dating">
    <header className="dating-head">
      <h1>Дейтинг напитков</h1>
      <p>Вправо — нравится, влево — пропустить. <span>Чем больше свайпов, тем точнее «Тебе понравится».</span></p>
    </header>
    <SwipeDeck cards={deck} signedIn={Boolean(viewerId)} rewards={datingRewards()} progress={progress} />
    {liked.length > 0 && <section className="dating-matches" aria-labelledby="dating-matches-title">
      <h2 id="dating-matches-title">Твои мэтчи</h2>
      <ul>{liked.map(item => <li key={`${item.brand}:${item.flavor}`}><Link href={item.href}>
        <span className="dating-match-cover"><Image src={item.cover} width={120} height={120} sizes="120px" alt="" /></span>
        <strong>{item.brand}</strong><span>{item.name}</span>
      </Link></li>)}</ul>
    </section>}
  </div>;
}
