import '@/styles/shared.css';
import '@/styles/market.css';
import '@/styles/catalog.css';
import type { Metadata } from 'next';
import Image from 'next/image';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { BrandShell } from '@/components/brand-shell';
import { CatalogDrinkForm } from '@/components/catalog-drink-form';
import Link from '@/components/navigation-progress';
import { ProfileBackButton } from '@/components/profile-back-button';
import { ProfileNavigation } from '@/components/profile-navigation';
import { auth } from '@/lib/auth';
import { loadAllCatalogGroups } from '@/lib/catalog';
import { BASIC_FLAVORS } from '@/lib/catalog-query';
import { volumeLabel } from '@/lib/catalog-drink-fields';
import { listOwnCatalogDrinks, type CatalogDrinkStatus } from '@/lib/catalog-drinks';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Добавить напиток', robots: { index: false, follow: false } };

const STATUS: Record<CatalogDrinkStatus, string> = { pending: 'На проверке', published: 'Опубликован', rejected: 'Нужно исправить' };

export default async function NewCatalogDrinkPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/sign-in');
  const [groups, own] = await Promise.all([loadAllCatalogGroups(), listOwnCatalogDrinks(session.user.id)]);
  const brands = [...new Set(groups.map(group => group.brand.trim()).filter(brand => brand && brand.toLowerCase() !== 'unknown'))].sort((a, b) => a.localeCompare(b, 'ru'));
  const flavors = [...BASIC_FLAVORS].sort((a, b) => a.label.localeCompare(b.label, 'ru'));
  return <BrandShell headerAction={<ProfileNavigation active="catalog" />}>
    <div className="market-layout catalog-drink-layout">
      <ProfileBackButton href="/catalog" label="Каталог" />
      <header className="store-editor-heading">
        <h1>Добавить напиток</h1>
        <p>Не нашли энергетик в каталоге? Расскажите о нём: бренд, вкус, фото банки и объём. После проверки модератором он появится в каталоге наравне с остальными.</p>
      </header>
      <CatalogDrinkForm brands={brands} flavors={flavors} />
      {own.length > 0 && <section className="catalog-drink-requests" aria-labelledby="catalog-drink-requests-title">
        <h2 id="catalog-drink-requests-title">Ваши заявки</h2>
        <ul>{own.map(drink => <li key={drink.id} data-status={drink.status}>
          <span className="catalog-drink-request-cover"><Image src={`${drink.photo}&size=thumbnail`} width={56} height={56} unoptimized alt="" /></span>
          <div>
            <p><b>{drink.brand} · {drink.name}</b><span className="catalog-drink-status">{STATUS[drink.status]}</span></p>
            <small>{drink.volumes.map(volumeLabel).join(' · ')}</small>
            {drink.status === 'rejected' && drink.moderationNote && <p className="catalog-drink-note">Модератор: {drink.moderationNote}</p>}
            {drink.status === 'published' && <Link href={drink.href}>Открыть в каталоге</Link>}
          </div>
        </li>)}</ul>
      </section>}
    </div>
  </BrandShell>;
}
