import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { BrandShell } from '@/components/brand-shell';
import { ProfileNavigation } from '@/components/profile-navigation';
import { TierListEditor } from '@/components/tier-list-editor';
import { auth } from '@/lib/auth';
import { loadCatalogGroups } from '@/lib/catalog';
import {
  catalogGroupsToTierProducts,
  getTierListBySlug,
  tierListProductsForPlacements,
} from '@/lib/tier-lists';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Редактирование тирлиста',
  robots: { index: false, follow: false },
};

export default async function EditTierListPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/sign-in');

  const [{ slug }, query, groups] = await Promise.all([params, searchParams, loadCatalogGroups()]);
  const list = await getTierListBySlug(slug);
  if (!list || list.userId !== session.user.id) notFound();

  const catalogProducts = catalogGroupsToTierProducts(groups);
  const catalogIds = new Set(catalogProducts.map((product) => product.id));
  const missingProducts = tierListProductsForPlacements(groups, list.items).filter((product) => !catalogIds.has(product.id));
  const products = [...catalogProducts, ...missingProducts].sort(
    (left, right) => right.retailerCount - left.retailerCount || left.brand.localeCompare(right.brand, 'ru-RU'),
  );

  return (
    <BrandShell headerAction={<ProfileNavigation active="tierlists" />} surfaceClassName="tierlists-surface">
      <div className="tier-editor-layout">
        <header className="tier-editor-heading">
          <p className="tierlists-kicker">Ваш список</p>
          <h1>Редактирование тирлиста</h1>
          <p>{list.status === 'published' ? 'Изменения появятся по публичной ссылке после сохранения.' : 'Черновик виден только вам, пока вы его не опубликуете.'}</p>
        </header>
        <TierListEditor products={products} initialList={list} saved={query.saved === '1'} />
      </div>
    </BrandShell>
  );
}
