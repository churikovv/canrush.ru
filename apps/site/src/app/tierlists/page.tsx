import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { BrandShell } from '@/components/brand-shell';
import { ProfileNavigation } from '@/components/profile-navigation';
import { ShareTierListButton } from '@/components/share-tier-list-button';
import { TierBoard } from '@/components/tier-board';
import { TierListCard } from '@/components/tier-list-card';
import { loadAllCatalogGroups } from '@/lib/catalog';
import {
  buildOfficialTierList,
  getCommunityTierLists,
  tierListProductsForPlacements,
} from '@/lib/tier-lists';
import { seoMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = seoMetadata({
  title: 'Тирлисты энергетиков',
  description: 'Рейтинг энергетических напитков CanRush по оценкам покупателей и пользовательские тирлисты, которыми можно поделиться.',
  path: '/tierlists',
});

export default async function TierListsPage() {
  const groups = await loadAllCatalogGroups();
  const [official, community] = await Promise.all([buildOfficialTierList(groups), getCommunityTierLists()]);
  const communityProducts = tierListProductsForPlacements(groups, community.flatMap((list) => list.preview));

  return (
    <BrandShell headerAction={<ProfileNavigation active="tierlists" />} surfaceClassName="tierlists-surface">
      <div className="tierlists-layout">
        <header className="tierlists-hero">
          <div>
            <p className="tierlists-kicker">Рейтинг CanRush</p>
            <h1>Тирлист энергетиков</h1>
            <p>
              В рейтинге участвуют напитки из четырёх и более магазинов, у которых есть минимум три отзыва.
            </p>
          </div>
          <dl className="tierlists-facts">
            <div><dt>Доступны широко</dt><dd>{official.eligibleCount}</dd></div>
            <div><dt>Получили оценку</dt><dd>{official.ratedCount}</dd></div>
          </dl>
        </header>

        <TierBoard products={official.products} placements={official.placements} emptyLabel="Ждём оценок" />

        {official.ratedCount === 0 ? (
          <div className="tierlists-rating-note">
            <strong>Официальный рейтинг заполнится после первых отзывов</strong>
            <p>Оцените дизайн, вкус и состав на страницах товаров. Для позиции в списке нужны три оценки.</p>
            <Link href="/catalog">Перейти в каталог</Link>
          </div>
        ) : null}

        <div className="tierlists-main-actions">
          <Link className="tier-primary-action" href="/tierlists/new">
            Создать свой
            <Image src="/brand/icons/tierlists.svg" width={22} height={22} alt="" />
          </Link>
          <ShareTierListButton title="Тирлист энергетиков CanRush" />
        </div>

        <section className="tierlists-community" aria-labelledby="community-title">
          <div className="tierlists-section-heading">
            <div>
              <p className="tierlists-kicker">Сообщество</p>
              <h2 id="community-title">Пользовательские тирлисты</h2>
            </div>
            {community.length > 0 ? <span>{community.length} последних</span> : null}
          </div>

          {community.length > 0 ? (
            <div className="tier-list-cards">
              {community.map((list) => <TierListCard list={list} products={communityProducts} key={list.id} />)}
            </div>
          ) : (
            <div className="tierlists-community-empty">
              <strong>Первый тирлист может быть вашим</strong>
              <p>Разложите знакомые энергетики по категориям и поделитесь результатом.</p>
              <Link href="/tierlists/new">Создать первый тирлист</Link>
            </div>
          )}
        </section>
      </div>
    </BrandShell>
  );
}
