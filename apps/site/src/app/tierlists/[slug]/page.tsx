import { ReviewDiscussion } from '@/components/review-discussion';
import { getTierInteractions } from '@/lib/tier-discussions';
import { TierScreenshotButton } from '@/components/tier-screenshot-button';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Image from 'next/image';
import Link from '@/components/navigation-progress';
import { notFound } from 'next/navigation';
import { BrandShell } from '@/components/brand-shell';
import { ProfileNavigation } from '@/components/profile-navigation';
import { ShareTierListButton } from '@/components/share-tier-list-button';
import { TierBoard } from '@/components/tier-board';
import { auth } from '@/lib/auth';
import { loadAllCatalogGroups } from '@/lib/catalog';
import { seoMetadata } from '@/lib/seo';
import { getTierListBySlug, tierListProductsForPlacements } from '@/lib/tier-lists';

export const dynamic = 'force-dynamic';

type TierListParams = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: TierListParams }): Promise<Metadata> {
  const { slug } = await params;
  const list = await getTierListBySlug(slug);
  if (!list || list.status !== 'published') return { title: 'Тирлист не найден', robots: { index: false, follow: false } };
  return seoMetadata({
    title: list.title,
    description: `Тирлист энергетических напитков от @${list.author.username}.`,
    path: `/tierlists/${list.slug}`,
  });
}

function displayName(name: string, username: string): string {
  const value = name.trim();
  return value && !value.includes('@') ? value : username;
}

export default async function TierListPage({ params }: { params: TierListParams }) {
  const { slug } = await params;
  const [list, session, groups] = await Promise.all([
    getTierListBySlug(slug),
    auth.api.getSession({ headers: await headers() }),
    loadAllCatalogGroups(),
  ]);
  if (!list) notFound();

  const isOwn = session?.user.id === list.userId;
  if (list.status !== 'published' && !isOwn) notFound();
  const interaction = list.status === 'published' ? (await getTierInteractions([list.id], session?.user.id ?? null)).get(list.id) : undefined;
  const products = tierListProductsForPlacements(groups, list.items);
  const telegramHref = list.author.telegramChannel ? `https://t.me/${list.author.telegramChannel}` : undefined;

  return (
    <BrandShell headerAction={<ProfileNavigation active="tierlists" />} surfaceClassName="tierlists-surface">
      <div className="tierlists-layout">
        <header className="tier-list-public-heading">
          <div>
            <div className="tier-list-public-meta">
              {list.status === 'draft' ? <span className="tier-list-status tier-list-status-draft">Черновик</span> : null}
              <Link href={`/profile/${list.author.username}`}>@{list.author.username}</Link>
            </div>
            <h1>{list.title}</h1>
            <p>Автор: {displayName(list.author.name, list.author.username)}</p>
          </div>
          {telegramHref ? (
            <a className="tier-list-telegram" href={telegramHref} target="_blank" rel="noreferrer">
              Telegram автора
              <Image src="/brand/icons/telegram.svg" width={22} height={22} alt="" />
            </a>
          ) : null}
        </header>

        <TierBoard products={products} placements={list.items} tiers={list.tiers} />

        <div className="tierlists-main-actions">
          {isOwn ? (
            <Link className="tier-primary-action" href={`/tierlists/${list.slug}/edit`}>
              Редактировать
              <Image src="/brand/icons/edit.svg" width={22} height={22} alt="" />
            </Link>
          ) : (
            <Link className="tier-primary-action" href="/tierlists/new">
              Создать свой
              <Image src="/brand/icons/tierlists.svg" width={22} height={22} alt="" />
            </Link>
          )}
          {list.status === 'published' ? <ShareTierListButton title={list.title} /> : null}
          <TierScreenshotButton boardId="tier-capture-board" title={list.title} telegramChannel={list.author.telegramChannel} authorUsername={list.author.username} />
        </div>
        {interaction && <ReviewDiscussion target="tierlist" reviewId={list.id} initial={interaction} />}
      </div>
    </BrandShell>
  );
}
