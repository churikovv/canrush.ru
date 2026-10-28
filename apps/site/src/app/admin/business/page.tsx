import '@/styles/shared.css';
import '@/styles/admin.css';
import '@/styles/business-cabinet.css';
import { AdminShell } from '@/components/admin-shell';
import { getAdminQueues } from '@/lib/admin-queues';
import { BusinessDrinkModeration, BusinessModeration, DrinkEditModeration, PromoModeration } from '@/components/business-forms';
import { listPromoRequests } from '@/lib/business-billing';
import { PLANS, PROMO_PLACEMENTS, effectivePlan, rubles } from '@/lib/business-plans';
import { getBrandProfile, listDrinkEditsForAdmin } from '@/lib/brand-drink-edits';
import { loadAllCatalogGroups } from '@/lib/catalog';
import { getCatalogDrink } from '@/lib/catalog-drinks';
import { getProductIngredients } from '@/lib/ingredients';
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
  { key: 'edits', label: 'Правки карточек', empty: 'Правок на проверке нет' },
  { key: 'promo', label: 'Продвижение', empty: 'Заявок на продвижение нет' },
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
  const businesses = tab.key === 'drinks' || tab.key === 'edits' || tab.key === 'promo' ? [] : await listBusinessesForAdmin(tab.key as BusinessStatus);
  const promos = tab.key === 'promo' ? await listPromoRequests(null) : [];
  const edits = tab.key === 'edits' ? await Promise.all((await listDrinkEditsForAdmin()).map(async edit => {
    const [profile, ingredients, added, group] = await Promise.all([getBrandProfile(edit.brand, edit.flavor), getProductIngredients(edit.brand, edit.flavor), getCatalogDrink(edit.brand, edit.flavor),
      loadAllCatalogGroups().then(groups => groups.find(item => item.brand === edit.brand && item.flavor === edit.flavor))]);
    return { edit, now: { fullName: profile?.fullName ?? added?.fullName ?? null, ingredients: profile?.ingredients ?? ingredients?.ingredients ?? added?.ingredients ?? null, description: profile?.description ?? null, cover: group?.coverImageUrl ?? null } };
  })) : [];
  const drinks = tab.key === 'drinks' ? await listPendingBusinessDrinks() : [];
  return <AdminShell queues={await getAdminQueues()} active="business" email={admin.email} role={admin.role} title="Компании" subtitle="Заявки бизнеса, напитки, которые компании прикрепляют к себе, и их правки карточек.">
      <nav className="market-filters" aria-label="Компании">{TABS.map(item => <Link key={item.key} href={item.key === 'pending' ? '/admin/business' : `/admin/business?tab=${item.key}`} aria-current={item.key === tab.key ? 'page' : undefined}>{item.label}</Link>)}</nav>
      {tab.key === 'promo' ? promos.length ? <div className="bc-content">{promos.map(item => <article key={item.id} className="bc-panel">
          <div className="bc-panel-head"><h2>{item.business} · {PROMO_PLACEMENTS.find(place => place.value === item.placement)?.label ?? item.placement}</h2><small>{rubles(item.budget)} · {when.format(item.createdAt)} · {item.status}</small></div>
          {item.comment && <p className="bc-about">{item.comment}</p>}
          {item.erid && <p className="bc-muted">erid: {item.erid}</p>}
          {admin.role === 'admin' ? <PromoModeration id={item.id} erid={item.erid} /> : <p className="bc-muted">Продвижение ведёт администратор.</p>}
        </article>)}</div> : <div className="admin-data-panel"><div className="admin-empty-result"><strong>{tab.empty}</strong></div></div>
      : tab.key === 'edits' ? edits.length ? <div className="bc-content">{edits.map(({ edit, now }) => <article key={edit.id} className="bc-panel bc-edit-review">
          <div className="bc-panel-head"><h2><Link href={`/catalog/${catalogGroupSlug(edit.brand, edit.flavor)}`}>{edit.name}</Link></h2><small>{edit.business}{edit.author ? ` · @${edit.author}` : ''} · {when.format(edit.createdAt)}</small></div>
          {edit.note && <p className="bc-about">Комментарий: {edit.note}</p>}
          <dl className="bc-edit-diff">
            {edit.hasPhoto && <div><dt>Фото</dt><dd className="bc-edit-photos">
              {/* eslint-disable-next-line @next/next/no-img-element -- the current cover and the proposed photo */}
              <span><small>Сейчас</small>{now.cover ? <img src={now.cover} alt="" /> : '—'}</span>
              {/* eslint-disable-next-line @next/next/no-img-element -- served to staff only */}
              <span><small>Предлагают</small><img src={`/api/brand-drink-edits/${edit.id}`} alt="" /></span></dd></div>}
            {([['fullName', 'Полное название'], ['ingredients', 'Состав'], ['description', 'Описание от бренда']] as const).filter(([key]) => edit[key]).map(([key, label]) => <div key={key}><dt>{label}</dt>
              <dd><span className="bc-edit-before"><small>Сейчас</small>{now[key] || '—'}</span><span className="bc-edit-after"><small>Предлагают</small>{edit[key]}</span></dd></div>)}
          </dl>
          <DrinkEditModeration id={edit.id} />
        </article>)}</div> : <div className="admin-data-panel"><div className="admin-empty-result"><strong>{tab.empty}</strong></div></div>
      : tab.key === 'drinks' ? drinks.length ? <div className="bc-panel"><div className="bc-table-wrap"><table className="bc-table">
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
          <p>{item.owner ? <Link href={`/profile/${item.owner}`}>@{item.owner}</Link> : 'Без ника'} · напитков {item.drinks}{item.pendingDrinks ? `, на проверке ${item.pendingDrinks}` : ''}{item.status === 'approved' ? ` · тариф «${PLANS[effectivePlan(item)].title}»${effectivePlan(item) !== 'start' && item.planUntil ? ` до ${when.format(item.planUntil)}` : ''}${item.founder ? ' · пилот' : ''}` : ''}</p>
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
}
