import { ReviewPhotoGallery } from '@/components/review-photo-gallery';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { addAdminAction, blockUserAction, deleteAdminReviewAction, deleteAdminTierListAction, deleteAdminWallAction, deleteAdminCommentAction, removeAdminAction, unblockUserAction } from '@/app/admin/actions';
import { AdminActionButton } from '@/components/admin-action-button';
import type { SiteAdminIdentity } from '@/lib/admin';
import { ADMIN_PAGE_SIZE, type AdminDashboardData } from '@/lib/admin-dashboard-data';
import { ADMIN_TABS, adminHref, type AdminTab } from '@/lib/admin-tabs';
import { catalogGroupSlug, flavorName } from '@/lib/catalog-query';

interface Props { admin: SiteAdminIdentity; data: AdminDashboardData; query: string; tab: AdminTab; notice?: string; error?: string }
const formatDate = (value: Date) => new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Europe/Moscow' }).format(value);
const number = (value: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(value);
function RecordText({ text }: { text: string }) {
  return text.length > 180 ? <details className="admin-record-text"><summary>{text.slice(0, 180)}…</summary><p>{text}</p></details> : <p className="admin-record-text">{text || 'Без текста'}</p>;
}
function DataTable({ columns, children, label }: { columns: string[]; children: ReactNode; label: string }) {
  return <div className="admin-table-scroll" tabIndex={0} role="region" aria-label={label}><table className="admin-table"><thead><tr>{columns.map(column => <th scope="col" key={column}>{column}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}

export function AdminDashboard({ admin, data, query, tab, notice, error }: Props) {
  const label = ADMIN_TABS.find(item => item.key === tab)!.label;
  const pages = Math.max(1, Math.ceil(data.total / ADMIN_PAGE_SIZE));
  const context = <><input type="hidden" name="query" value={query} /><input type="hidden" name="tab" value={tab} /><input type="hidden" name="page" value={data.page} /></>;
  const metrics = data.metrics;
  const maxRegistrations = Math.max(1, ...data.registrations.map(day => day.count));
  return <div className="admin-layout admin-dashboard ym-hide-content ym-disable-clickmap">
    <header className="admin-dashboard-heading"><div><h1>Администрирование</h1><p>CanRush · Управление сайтом</p></div><span className="admin-account">{admin.email}</span></header>
    <nav className="admin-dashboard-tabs" aria-label="Разделы администрирования">
      {ADMIN_TABS.map(item => <Link key={item.key} href={adminHref(item.key)} aria-current={item.key === tab ? 'page' : undefined}>{item.label}</Link>)}
    </nav>
    {notice && <div className="admin-feedback admin-feedback-success" role="status">{notice}</div>}
    {error && <div className="admin-feedback admin-feedback-error" role="alert">{error}</div>}
    {tab === 'analytics' && metrics && <>
      <section aria-labelledby="admin-overview-title"><div className="admin-panel-heading"><h2 id="admin-overview-title">Обзор сайта</h2><span>Данные на момент открытия</span></div>
        <div className="admin-metrics">{[
          { label: 'Участники', value: metrics.users, note: `+${number(metrics.newUsers)} за 30 дней`, tab: 'users' },
          { label: 'Отзывы', value: metrics.reviews, note: `+${number(metrics.newReviews)} за 30 дней`, tab: 'reviews' },
          { label: 'Тирлисты', value: metrics.tierLists, note: `+${number(metrics.newTierLists)} за 30 дней`, tab: 'tierlists' },
          { label: 'Комментарии стены', value: metrics.wall, note: `+${number(metrics.newWall)} за 30 дней`, tab: 'wall' },
          { label: 'Администраторы', value: metrics.admins, note: 'Включая владельца', tab: 'admins' },
          { label: 'Активные сессии', value: metrics.sessions, note: 'Уникальные участники с действующим входом', tab: 'users' },
        ].map(item => <Link href={adminHref(item.tab as AdminTab)} className="admin-metric" key={item.label}><span>{item.label}</span><strong>{number(item.value)}</strong><small>{item.note}</small></Link>)}</div>
      </section>
      <div className="admin-analytics-grid">
        <section className="admin-data-panel" aria-labelledby="admin-registrations-title"><div className="admin-panel-heading"><h2 id="admin-registrations-title">Регистрации</h2><span>14 дней · МСК</span></div>
          <div className="admin-registration-chart" role="img" aria-label={`Регистрации по дням: ${data.registrations.map(day => `${day.day}: ${day.count}`).join('; ')}`}>
            {data.registrations.map(day => <div className="admin-chart-column" key={day.day} title={`${day.day}: ${day.count}`}><strong>{day.count}</strong><div className="admin-chart-track"><span style={{ height: `${day.count / maxRegistrations * 100}%` }} /></div><small>{day.day.slice(8)}</small></div>)}
          </div>
          {!data.registrations.some(day => day.count) && <p className="admin-chart-note">За последние 14 дней новых регистраций нет.</p>}
        </section>
        <section className="admin-data-panel" aria-labelledby="admin-state-title"><div className="admin-panel-heading"><h2 id="admin-state-title">Контент и модерация</h2></div><dl className="admin-summary-list">
          <div><dt>Опубликованные тирлисты</dt><dd>{number(metrics.published)}</dd></div><div><dt>Черновики</dt><dd>{number(metrics.drafts)}</dd></div>
          <div><dt>Заблокированные участники</dt><dd>{number(metrics.blocked)}</dd></div><div><dt>Средняя оценка напитков</dt><dd>{metrics.averageRating === null ? 'Нет оценок' : `${number(metrics.averageRating)} / 10`}</dd></div>
        </dl></section>
      </div>
    </>}
    {tab !== 'analytics' && <section className="admin-data-panel" aria-labelledby="admin-current-title">
      <div className="admin-panel-heading"><h2 id="admin-current-title">{label} <span>{number(data.total)}</span></h2><span>{query ? 'По результатам поиска' : 'Все записи'}</span></div>
      <form key={`${tab}:${query}`} className="admin-table-search" method="get" role="search"><input type="hidden" name="tab" value={tab} />
        <label htmlFor="admin-search-input" className="sr-only">Поиск в разделе «{label}»</label><input id="admin-search-input" name="q" type="search" defaultValue={query} maxLength={80} placeholder={tab === 'admins' ? 'Найти по email' : 'Имя, email или содержимое'} />
        <button type="submit" className="community-button community-button-secondary">Найти</button>{query && <Link href={adminHref(tab)}>Сбросить</Link>}
      </form>
      {tab === 'admins' && <form className="admin-invite-form" action={addAdminAction}><label htmlFor="admin-email">Добавить администратора</label><div><input id="admin-email" name="email" type="email" required autoComplete="email" maxLength={320} placeholder="name@example.com" />{context}<AdminActionButton pendingLabel="Добавляем…" variant="primary">Добавить</AdminActionButton></div></form>}
      {data.total === 0 ? <div className="admin-empty-result"><strong>{query ? 'Ничего не найдено' : 'Здесь пока пусто'}</strong><span>{query ? 'Измените запрос или сбросьте поиск.' : 'Записи появятся после действий пользователей.'}</span></div> : <>
        {tab === 'users' && <DataTable label="Участники" columns={['Участник', 'Отзывы', 'Тирлисты', 'Регистрация', 'Статус', 'Действия']}>{data.users.map(user => <tr key={user.id}>
          <td><div className="admin-table-identity">{user.username ? <Link href={`/profile/${user.username}`}>{user.name || `@${user.username}`}</Link> : <strong>{user.name || 'Без имени'}</strong>}<span>{user.email}</span>{user.username && <span>@{user.username}</span>}</div></td><td>{user.reviewCount}</td><td>{user.tierListCount}</td><td>{formatDate(user.createdAt)}</td>
          <td><span className={`admin-status ${user.isAdmin ? 'admin-status-admin' : user.blockedAt ? 'admin-status-blocked' : 'admin-status-active'}`}>{user.isAdmin ? 'Администратор' : user.blockedAt ? 'Заблокирован' : 'Активен'}</span></td>
          <td>{!user.isAdmin ? <form action={user.blockedAt ? unblockUserAction : blockUserAction}>{context}<input type="hidden" name="userId" value={user.id} /><AdminActionButton pendingLabel="Сохраняем…" variant={user.blockedAt ? 'secondary' : 'danger'} confirmMessage={user.blockedAt ? undefined : `Заблокировать ${user.email}?`}>{user.blockedAt ? 'Разблокировать' : 'Заблокировать'}</AdminActionButton></form> : <span className="admin-table-muted">Защищён</span>}</td>
        </tr>)}</DataTable>}
        {tab === 'tierlists' && <DataTable label="Тирлисты" columns={['Тирлист', 'Автор', 'Позиций', 'Статус', 'Обновлён', 'Действия']}>{data.tierLists.map(list => <tr key={list.id}><td>{list.status === 'published' ? <Link href={`/tierlists/${list.slug}`}>{list.title}</Link> : list.title}</td><td><div className="admin-table-identity"><strong>{list.authorName}</strong><span>{list.authorEmail}</span></div></td><td>{list.itemCount}</td><td><span className="admin-status">{list.status === 'published' ? 'Опубликован' : 'Черновик'}</span></td><td>{formatDate(list.updatedAt)}</td><td><form action={deleteAdminTierListAction}>{context}<input type="hidden" name="slug" value={list.slug} /><AdminActionButton pendingLabel="Удаляем…" variant="danger" confirmMessage={`Удалить тирлист «${list.title}» без возможности восстановления?`}>Удалить</AdminActionButton></form></td></tr>)}</DataTable>}
        {tab === 'reviews' && <DataTable label="Отзывы" columns={['Напиток', 'Автор', 'Оценка', 'Текст', 'Дата', 'Действия']}>{data.reviews.map(review => <tr key={review.id}><td><strong>{review.brand}</strong><div className="admin-table-muted">{flavorName(review.flavor)}</div></td><td><div className="admin-table-identity"><strong>{review.authorName}</strong><span>{review.authorEmail}</span></div></td><td>{number(review.score)} / 10</td><td><RecordText text={review.text} /></td><td>{formatDate(review.createdAt)}</td><td><form action={deleteAdminReviewAction}>{context}<input type="hidden" name="reviewId" value={review.id} /><AdminActionButton pendingLabel="Удаляем…" variant="danger" confirmMessage="Удалить отзыв без возможности восстановления?">Удалить</AdminActionButton></form></td></tr>)}</DataTable>}
        {tab === 'comments' && <DataTable label="Комментарии к отзывам" columns={['Автор', 'Отзыв', 'Комментарий', 'Дата', 'Действия']}>{data.comments.map(comment => <tr key={comment.id}><td><div className="admin-table-identity"><strong>{comment.authorName}</strong><span>{comment.authorEmail}</span></div></td><td><Link href={`/catalog/${catalogGroupSlug(comment.brand, comment.flavor)}?tab=reviews#review-${comment.reviewId}`}>{comment.brand} · {flavorName(comment.flavor)}</Link></td><td><RecordText text={comment.text} /></td><td>{formatDate(comment.createdAt)}</td><td><form action={deleteAdminCommentAction}>{context}<input type="hidden" name="commentId" value={comment.id} /><AdminActionButton pendingLabel="Удаляем…" variant="danger" confirmMessage="Удалить комментарий к отзыву?">Удалить</AdminActionButton></form></td></tr>)}</DataTable>}
        {tab === 'wall' && <DataTable label="Комментарии стены" columns={['Автор', 'На стене', 'Комментарий', 'Дата', 'Действия']}>{data.wall.map(comment => <tr key={comment.id}><td><div className="admin-table-identity">{comment.authorUsername ? <Link href={`/profile/${comment.authorUsername}`}>@{comment.authorUsername}</Link> : <strong>{comment.authorName}</strong>}<span>{comment.authorEmail}</span></div></td><td>{comment.profileUsername ? <Link href={`/profile/${comment.profileUsername}#wall`}>@{comment.profileUsername}</Link> : 'Без юзернейма'}</td><td><RecordText text={comment.text} /><ReviewPhotoGallery photos={comment.photos} source="wall-photos" /></td><td>{formatDate(comment.createdAt)}</td><td><form action={deleteAdminWallAction}>{context}<input type="hidden" name="commentId" value={comment.id} /><AdminActionButton pendingLabel="Удаляем…" variant="danger" confirmMessage="Удалить комментарий со стены без возможности восстановления?">Удалить</AdminActionButton></form></td></tr>)}</DataTable>}
        {tab === 'admins' && <DataTable label="Администраторы" columns={['Email', 'Роль', 'Добавлен', 'Кем', 'Действия']}>{data.admins.map(entry => <tr key={entry.email}><td>{entry.email}</td><td><span className="admin-status admin-status-admin">{entry.isOwner ? 'Владелец' : 'Администратор'}</span></td><td>{formatDate(entry.createdAt)}</td><td>{entry.addedByName ?? '—'}</td><td>{!entry.isOwner && entry.email !== admin.email ? <form action={removeAdminAction}>{context}<input type="hidden" name="email" value={entry.email} /><AdminActionButton pendingLabel="Удаляем…" variant="danger" confirmMessage={`Убрать доступ у ${entry.email}?`}>Убрать доступ</AdminActionButton></form> : <span className="admin-table-muted">Защищён</span>}</td></tr>)}</DataTable>}
      </>}
      {data.total > 0 && <nav className="admin-table-pagination" aria-label="Страницы записей"><span>{(data.page - 1) * ADMIN_PAGE_SIZE + 1}–{Math.min(data.page * ADMIN_PAGE_SIZE, data.total)} из {number(data.total)}</span><div>{data.page > 1 && <Link href={adminHref(tab, query, data.page - 1)}>← Назад</Link>}<span>{data.page} / {pages}</span>{data.page < pages && <Link href={adminHref(tab, query, data.page + 1)}>Далее →</Link>}</div></nav>}
    </section>}
  </div>;
}
