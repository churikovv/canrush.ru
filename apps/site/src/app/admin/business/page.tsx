import '@/styles/shared.css';
import '@/styles/admin.css';
import '@/styles/business-cabinet.css';
import { AdminShell } from '@/components/admin-shell';
import { BrandShell } from '@/components/brand-shell';
import { BusinessDrinkModeration, BusinessModeration } from '@/components/business-forms';
import Link from '@/components/navigation-progress';
import { requireSiteAdmin } from '@/lib/admin';
import { listBusinessesForAdmin, listPendingBusinessDrinks } from '@/lib/business';
import { BUSINESS_KINDS, type BusinessStatus } from '@/lib/business-fields';
import { catalogGroupSlug } from '@/lib/catalog-query';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Компании', robots: { index: false, follow: false } };
const when = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Moscow' });
const TABS = [
  { key: 'pending', label: 'На проверке', empty: 'Новых заявок нет' },
  { key: 'drinks', label: 'Напитки компаний', empty: 'Все напитки проверены' },
  { key: 'approved', label: 'Подтверждённые', empty: 'Пока ни одной компании' },
  { key: 'rejected', label: 'Отклонённые', empty: 'Отклонённых нет' },
] as const;

/**
 * Companies of «CanRush для бизнеса»: applications (check the company through its official contacts) and the drinks
 * they attach (check that the drink is theirs). Both decisions are logged.
 */
export default async function AdminBusinessPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const admin = await requireSiteAdmin();
  const requested = (await searchParams).tab;
  const tab = TABS.find(item => item.key === requested) ?? TABS[0];
  const businesses = tab.key === 'drinks' ? [] : await listBusinessesForAdmin(tab.key as BusinessStatus);
  const drinks = tab.key === 'drinks' ? await listPendingBusinessDrinks() : [];
  return <BrandShell headerAction={<Link className="admin-back-link" href="/profile/settings">Вернуться в настройки</Link>} surfaceClassName="admin-surface">
    <AdminShell active="business" email={admin.email} role={admin.role} title="Компании" subtitle="Заявки бизнеса и напитки, которые компании прикрепляют к себе.">
      <nav className="market-filters" aria-label="Компании">{TABS.map(item => <Link key={item.key} href={item.key === 'pending' ? '/admin/business' : `/admin/business?tab=${item.key}`} aria-current={item.key === tab.key ? 'page' : undefined}>{item.label}</Link>)}</nav>
      {tab.key === 'drinks' ? drinks.length ? <div className="bc-panel"><div className="bc-table-wrap"><table className="bc-table">
        <thead><tr><th>Компания</th><th>Напиток</th><th>Заявка</th><th>Решение</th></tr></thead>
        <tbody>{drinks.map(item => <tr key={`${item.businessId}:${item.brand}:${item.flavor}`}>
          <td data-label="Компания"><strong>{item.business}</strong></td>
          <td data-label="Напиток"><Link href={`/catalog/${catalogGroupSlug(item.brand, item.flavor)}`}>{item.name}</Link></td>
          <td data-label="Заявка">{when.format(item.createdAt)}</td>
          <td data-label="Решение"><BusinessDrinkModeration businessId={item.businessId} brand={item.brand} flavor={item.flavor} /></td>
        </tr>)}</tbody>
      </table></div></div> : <div className="admin-data-panel"><div className="admin-empty-result"><strong>{tab.empty}</strong></div></div>
        : businesses.length ? <div className="bc-content">{businesses.map(item => <article key={item.id} className="bc-panel">
          <div className="bc-panel-head"><h2>{item.name}</h2><small>{BUSINESS_KINDS.find(kind => kind.value === item.kind)?.label} · {when.format(item.createdAt)}</small></div>
          <p>{item.owner ? <Link href={`/profile/${item.owner}`}>@{item.owner}</Link> : 'Без ника'} · напитков {item.drinks}{item.pendingDrinks ? `, на проверке ${item.pendingDrinks}` : ''}</p>
          <ul className="bc-contacts">
            {item.website && <li><a href={item.website} target="_blank" rel="noopener noreferrer">{item.website}</a></li>}
            {item.telegram && <li><a href={`https://t.me/${item.telegram}`} target="_blank" rel="noopener noreferrer">@{item.telegram}</a></li>}
            {item.contactEmail && <li><a href={`mailto:${item.contactEmail}`}>{item.contactEmail}</a></li>}
          </ul>
          {item.about && <p className="bc-about">{item.about}</p>}
          {item.status === 'rejected' && item.moderationNote && <p className="bc-note">Причина: {item.moderationNote}</p>}
          {item.status === 'pending' && <BusinessModeration id={item.id} />}
        </article>)}</div> : <div className="admin-data-panel"><div className="admin-empty-result"><strong>{tab.empty}</strong></div></div>}
    </AdminShell>
  </BrandShell>;
}
