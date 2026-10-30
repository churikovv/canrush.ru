import '@/styles/shared.css';
import '@/styles/profile.css';
import '@/styles/gacha.css';
import { headers } from 'next/headers';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import Link from '@/components/navigation-progress';
import { BrandShell } from '@/components/brand-shell';
import { GachaCraftButton } from '@/components/gacha-craft-button';
import { ShardIcon } from '@/components/gacha-machine';
import { ProfileBackButton } from '@/components/profile-back-button';
import { ProfileNavigation } from '@/components/profile-navigation';
import { ProfileSubpageOwner } from '@/components/profile-subpage-owner';
import { auth } from '@/lib/auth';
import { getAlbum, type AlbumBrand } from '@/lib/gacha';
import { RARITIES, RARITY_LABELS, rarityRank } from '@/lib/gacha-fields';
import { RarityEmblem, RarityShine } from '@/components/rarity-badge';
import { profileThemeAttributes } from '@/lib/profile-appearance';
import { getProfileByUsername } from '@/lib/profile';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Альбом карточек', robots: { index: false, follow: false } };

/** Альбом Банкомата: бренды с карточками первыми, недостающие банки — силуэтами без названия. */
export default async function GachaAlbumPage({ params }: { params: Promise<{ username: string }> }) {
  const [{ username }, session] = await Promise.all([params, auth.api.getSession({ headers: await headers() })]);
  const profile = await getProfileByUsername(username);
  if (!profile) notFound();
  const isOwn = session?.user.id === profile.id;
  const album = await getAlbum(profile.id);
  const brands = album.brands.filter(brand => brand.owned > 0);
  const rest = album.brands.filter(brand => brand.owned === 0);

  return <BrandShell headerAction={<ProfileNavigation active="profile" />} surfaceClassName="profile-surface">
    <section className="community-directory gacha-album-page" {...profileThemeAttributes(profile.profileAppearance?.theme)}>
      <ProfileBackButton href={isOwn ? '/profile' : `/profile/${profile.username}`} />
      <div className="profile-subpage-title"><h1>Альбом карточек</h1>{!isOwn && <ProfileSubpageOwner profile={profile} />}</div>
      <div className="community-panel gacha-album-intro">
        <div className="gacha-album-total"><strong>{album.owned}</strong><span>из {album.total} банок</span>
          {isOwn && <span className="gacha-balance is-shards" title="Осколки: дубли превращаются в них, из них собираются недостающие карточки"><ShardIcon size={16} />{album.shards}</span>}</div>
        <ul className="gacha-album-rarities">{[...RARITIES].reverse().map(rarity => <li key={rarity} data-rarity={rarity}><RarityEmblem rarity={rarity} /><span>{RARITY_LABELS[rarity]}</span><strong>{album.byRarity[rarity]}</strong></li>)}</ul>
        <Link className="community-button gacha-album-cta" href="/gacha">{isOwn ? 'Крутить Банкомат' : 'Открыть Банкомат'}</Link>
      </div>
      {isOwn && <p className="community-muted gacha-album-help">Дубль приносит осколки (1 / 3 / 10 / 30 по редкости). Нажмите цену под пустой ячейкой, чтобы собрать недостающую банку.</p>}
      {brands.length ? brands.map(brand => <BrandCards key={brand.brand} brand={brand} isOwn={isOwn} shards={album.shards} />)
        : <div className="community-panel gacha-album-empty"><p>{isOwn ? 'Пока ни одной карточки. Первая крутка в день — бесплатно.' : 'Пока ни одной карточки.'}</p></div>}
      {rest.length > 0 && <details className="gacha-album-rest">
        <summary>Ещё {rest.length} брендов ждут первой карточки</summary>
        {rest.map(brand => <BrandCards key={brand.brand} brand={brand} isOwn={isOwn} shards={album.shards} />)}
      </details>}
    </section>
  </BrandShell>;
}

/** Бренд в альбоме: свои карточки с фото, недостающие — силуэтами (владельцу — с ценой крафта). */
function BrandCards({ brand, isOwn, shards }: { brand: AlbumBrand; isOwn: boolean; shards: number }) {
  return <section className="gacha-album-brand" aria-label={brand.brand}>
    <div className="gacha-album-brand-head"><h2>{brand.brand}</h2><span>{brand.owned}/{brand.total}</span></div>
    <div className="gacha-album-grid">{brand.cards.map(card => card.owned
      ? <Link key={card.flavor} className="gacha-album-card rarity-card" href={card.href} data-rarity={card.rarity} title={`${RARITY_LABELS[card.rarity]} · ×${card.count}`}>
          {rarityRank(card.rarity) >= rarityRank('epic') && <RarityShine rarity={card.rarity} twinkles={false} />}
          <span className="gacha-card-cover"><Image src={card.cover} width={120} height={120} sizes="96px" unoptimized alt="" loading="lazy" /></span>
          <span className="gacha-album-name">{card.name}</span>
          {card.count > 1 && <span className="gacha-album-count">×{card.count}</span>}
        </Link>
      : <span key={card.flavor} className="gacha-album-card is-missing" aria-label="Ещё не выпала"><span className="gacha-card-cover"><span className="gacha-album-silhouette" /></span>{isOwn && <GachaCraftButton brand={card.brand} flavor={card.flavor} name={card.name} cost={card.cost} shards={shards} />}</span>)}
    </div>
  </section>;
}
