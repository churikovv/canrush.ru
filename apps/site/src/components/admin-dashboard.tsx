import { CONTENT_REPORT_KINDS, REPORT_REASONS } from '@/lib/profile-report-fields';
import Image from 'next/image';
import Link from '@/components/navigation-progress';
import { AdminMemberMenu } from '@/components/admin-member-menu';
import { AvatarFrame } from '@/components/avatar-frame';
import { LevelChip } from '@/components/level-badge';
import { experienceLevel } from '@/lib/experience-level';
import { profileTagLabel } from '@/lib/profile-achievements';
import type { ReactNode } from 'react';
import { reviewProfileReportAction, addAdminAction, blockUserAction, removeAdminAction, setAdminRoleAction, unblockUserAction } from '@/app/admin/actions';
import { AdminActionButton } from '@/components/admin-action-button';
import type { SiteAdminIdentity } from '@/lib/admin';
import { SITE_ROLE_LABELS } from '@/lib/admin-roles';
import { ADMIN_PAGE_SIZE, type AdminDashboardData } from '@/lib/admin-dashboard-data';
import { ADMIN_TABS, adminHref, type AdminTab } from '@/lib/admin-tabs';
import { AdminIcon, AdminShell, type AdminIconName } from '@/components/admin-shell';
import { flavorName } from '@/lib/catalog-query';

interface Props { admin: SiteAdminIdentity; data: AdminDashboardData; query: string; tab: AdminTab; notice?: string; error?: string; campaignPanel?: ReactNode }
const SUBTITLES: Record<AdminTab, string> = {
  analytics: 'Ключевые показатели сайта на момент открытия',
  campaigns: 'UTM-ссылки и переходы по размещениям',
  users: 'Аккаунты, активность и блокировки',
  market: 'Объявления участников и продавцы',
  reports: 'Жалобы участников на профили и контент',
  admins: 'Доступ к админ-панели',
};
const formatDate = (value: Date) => new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Europe/Moscow' }).format(value);
const number = (value: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(value);
function RecordText({ text }: { text: string }) {
  return text.length > 180 ? <details className="admin-record-text"><summary>{text.slice(0, 180)}…</summary><p>{text}</p></details> : <p className="admin-record-text">{text || 'Без текста'}</p>;
}
function DataTable({ columns, children, label }: { columns: string[]; children: ReactNode; label: string }) {
  return <div className="admin-table-scroll" tabIndex={0} role="region" aria-label={label}><table className="admin-table"><thead><tr>{columns.map(column => <th scope="col" key={column}>{column}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}

export function AdminDashboard({ admin, data, query, tab, notice, error, campaignPanel }: Props) {
  const label = ADMIN_TABS.find(item => item.key === tab)!.label;
  const pages = Math.max(1, Math.ceil(data.total / ADMIN_PAGE_SIZE));
  const context = <><input type="hidden" name="query" value={query} /><input type="hidden" name="tab" value={tab} /><input type="hidden" name="page" value={data.page} /></>;
  const metrics = data.metrics;
  const maxRegistrations = Math.max(1, ...data.registrations.map(day => day.count));
  const maxActivity = Math.max(1, ...data.activity.map(day => day.count));
  const maxOnline = Math.max(1, ...data.onlineByHour.map(hour => hour.peak));
  const maxSwipes = Math.max(1, ...data.swipesByDay.map(day => day.count));
  const onlinePeak = data.onlineByHour.reduce<(typeof data.onlineByHour)[number] | null>((best, hour) => hour.peak > 0 && hour.peak >= (best?.peak ?? 0) ? hour : best, null);
  return <AdminShell active={tab} email={admin.email} role={admin.role} title={label} subtitle={SUBTITLES[tab]}>
    {notice && <div className="admin-feedback admin-feedback-success" role="status">{notice}</div>}
    {error && <div className="admin-feedback admin-feedback-error" role="alert">{error}</div>}
    {tab === 'analytics' && metrics && <>
      <section aria-label="Обзор сайта">
        <div className="admin-metrics">{[
          { label: 'Участники', value: metrics.users, delta: metrics.newUsers, note: 'за 30 дней', tab: 'users' },
          { label: 'В сети сейчас', value: metrics.online, delta: null, note: 'Активны за 2 минуты, без скрывших статус', tab: 'users', live: true },
          { label: 'Активны сегодня', value: metrics.activeToday, delta: null, note: 'Заходили с входом с начала дня по Москве', tab: 'users' },
          { label: 'Активны за неделю', value: metrics.activeWeek, delta: null, note: 'Разные участники за 7 дней, включая сегодня', tab: 'users' },
          { label: 'Отзывы', value: metrics.reviews, delta: metrics.newReviews, note: 'за 30 дней', href: '/catalog', icon: 'reviews' },
          { label: 'Тирлисты', value: metrics.tierLists, delta: metrics.newTierLists, note: 'за 30 дней', href: '/tierlists', icon: 'tierlists' },
          { label: 'Записи стены', value: metrics.wall, delta: metrics.newWall, note: 'за 30 дней', href: '/feed', icon: 'wall' },
          ...(admin.role === 'admin' ? [{ label: 'Администраторы', value: metrics.admins, delta: null, note: 'Включая владельца и модераторов', tab: 'admins' }] : []),
          { label: 'Активные сессии', value: metrics.sessions, delta: null, note: 'Участники с действующим входом', tab: 'users' },
        ].map(item => <Link href={'href' in item && item.href ? item.href : adminHref(item.tab as AdminTab)} className="admin-metric" key={item.label}><span className="admin-metric-head"><span className="admin-metric-icon">{'live' in item ? <span className="admin-online-dot" /> : <AdminIcon section={('icon' in item && item.icon ? item.icon : item.tab) as AdminIconName} />}</span>{item.label}</span><strong>{number(item.value)}</strong><small>{item.delta !== null && <b className={item.delta > 0 ? 'admin-delta admin-delta-up' : 'admin-delta'}>+{number(item.delta)}</b>}{item.note}</small></Link>)}</div>
      </section>
      <section className="admin-data-panel" aria-labelledby="admin-online-title"><div className="admin-panel-heading"><h2 id="admin-online-title">Онлайн за сутки</h2><span>{onlinePeak ? `Пик ${number(onlinePeak.peak)} в ${onlinePeak.hour.slice(11)}` : 'Пока без данных'} · 24 часа · МСК</span></div>
        <div className="admin-registration-chart admin-online-chart" role="img" aria-label={`Пиковый онлайн по часам: ${data.onlineByHour.map(hour => `${hour.hour.slice(11)}: ${hour.peak}`).join('; ')}`}>
          {data.onlineByHour.map((hour, index) => <div className="admin-chart-column" key={hour.hour} title={`${hour.hour.slice(11)}–${hour.hour.slice(11, 13)}:59 · до ${hour.peak} в сети`} data-current={index === data.onlineByHour.length - 1 || undefined}><strong>{hour.peak}</strong><div className="admin-chart-track"><span style={{ height: `${hour.peak / maxOnline * 100}%` }} /></div><small>{hour.hour.slice(11, 13)}</small></div>)}
        </div>
        <p className="admin-chart-note">{onlinePeak ? 'Максимум участников, активных в одном 5-минутном окне за час. Скрывшие статус не учитываются.' : 'График заполнится, когда участники начнут заходить на сайт: история онлайна собирается с этого обновления.'}</p>
      </section>
      <section className="admin-data-panel" aria-labelledby="admin-activity-title"><div className="admin-panel-heading"><h2 id="admin-activity-title">Активные участники</h2><span>14 дней · МСК</span></div>
        <div className="admin-registration-chart" role="img" aria-label={`Активные участники по дням: ${data.activity.map(day => `${day.day}: ${day.count}`).join('; ')}`}>
          {data.activity.map(day => <div className="admin-chart-column" key={day.day} title={`${day.day}: ${day.count}`}><strong>{day.count}</strong><div className="admin-chart-track"><span style={{ height: `${day.count / maxActivity * 100}%` }} /></div><small>{day.day.slice(8)}</small></div>)}
        </div>
        <p className="admin-chart-note">{data.activity.some(day => day.count) ? 'Участники, которые хотя бы раз открыли сайт с входом в этот день. Учитываются и скрывшие статус, имён здесь нет.' : 'График заполнится с сегодняшнего дня: активность раньше не записывалась.'}</p>
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
      <div className="admin-analytics-grid">
        <section className="admin-data-panel" aria-labelledby="admin-swipes-title"><div className="admin-panel-heading"><h2 id="admin-swipes-title">Свайпы в дейтинге</h2><span>14 дней · МСК</span></div>
          <div className="admin-registration-chart" role="img" aria-label={`Свайпы по дням: ${data.swipesByDay.map(day => `${day.day}: ${day.count}, участников ${day.members}`).join('; ')}`}>
            {data.swipesByDay.map(day => <div className="admin-chart-column" key={day.day} title={`${day.day}: ${day.count} свайпов (♥ ${day.likes}, ✕ ${day.count - day.likes}) · участников ${day.members}`}><strong>{day.count}</strong><div className="admin-chart-track"><span style={{ height: `${day.count / maxSwipes * 100}%` }} /></div><small>{day.day.slice(8)}</small></div>)}
          </div>
          <p className="admin-chart-note">{data.swipesByDay.some(day => day.count) ? 'По дню последнего решения: повторный свайп переносит его на новый день, «Вернуть» удаляет.' : 'За последние 14 дней свайпов нет.'}</p>
        </section>
        <section className="admin-data-panel" aria-labelledby="admin-dating-title"><div className="admin-panel-heading"><h2 id="admin-dating-title">Дейтинг</h2></div><dl className="admin-summary-list">
          <div><dt>Свайпов всего</dt><dd>{number(metrics.swipes)}</dd></div>
          <div><dt>Нравится / Пропущено</dt><dd>{number(metrics.swipeLikes)} / {number(metrics.swipes - metrics.swipeLikes)}</dd></div>
          <div><dt>Свайпали участников</dt><dd>{number(metrics.swipers)}</dd></div>
          <div><dt>Из них за 7 дней</dt><dd>{number(metrics.swipersWeek)}</dd></div>
          <div><dt>Топ лайков</dt><dd className="admin-summary-wrap">{metrics.topSwipe ? `${metrics.topSwipe.brand}, ${flavorName(metrics.topSwipe.flavor)} · ${number(metrics.topSwipe.likes)}` : 'Пока нет'}</dd></div>
        </dl></section>
      </div>
    </>}
    {tab === 'campaigns' && campaignPanel}
    {tab !== 'analytics' && tab !== 'campaigns' && <section className="admin-data-panel" aria-labelledby="admin-current-title">
      <div className="admin-panel-heading"><h2 id="admin-current-title">{label} <span>{number(data.total)}</span></h2><span>{query ? 'По результатам поиска' : 'Все записи'}</span></div>
      <form key={`${tab}:${query}`} className="admin-table-search" method="get" role="search"><input type="hidden" name="tab" value={tab} />
        <label htmlFor="admin-search-input" className="sr-only">Поиск в разделе «{label}»</label><input id="admin-search-input" name="q" type="search" defaultValue={query} maxLength={80} placeholder={tab === 'admins' ? 'Найти по email' : 'Имя, email или содержимое'} />
        <button type="submit" className="community-button community-button-secondary">Найти</button>{query && <Link href={adminHref(tab)}>Сбросить</Link>}
      </form>
      {tab === 'admins' && <form className="admin-invite-form" action={addAdminAction}><label htmlFor="admin-email">Добавить в команду</label><div><input id="admin-email" name="email" type="email" required autoComplete="email" maxLength={320} placeholder="name@example.com" /><label className="sr-only" htmlFor="admin-role">Роль</label><select id="admin-role" name="role" defaultValue="moderator"><option value="moderator">Модератор</option><option value="admin">Администратор</option></select>{context}<AdminActionButton pendingLabel="Добавляем…" variant="primary">Добавить</AdminActionButton></div></form>}
      {data.total === 0 ? <div className="admin-empty-result"><strong>{query ? 'Ничего не найдено' : 'Здесь пока пусто'}</strong><span>{query ? 'Измените запрос или сбросьте поиск.' : 'Записи появятся после действий пользователей.'}</span></div> : <>
        {tab === 'market' && <DataTable label="Объявления маркета" columns={['Объявление', 'Продавец', 'Дата', 'Статус', 'Действия']}>{data.market.map(listing => <tr key={listing.id}>
          <td><Link href={`/market/${listing.id}`}>{listing.title}</Link></td>
          <td><div className="admin-table-identity">{listing.username ? <Link href={`/profile/${listing.username}`}>{listing.sellerName}</Link> : <strong>{listing.sellerName}</strong>}<span>{listing.sellerEmail}</span></div></td>
          <td>{formatDate(listing.createdAt)}</td><td>{listing.deletedAt ? 'Удалено владельцем' : listing.closed ? 'В архиве' : 'Опубликовано'}{listing.blockedAt && <div className="admin-status admin-status-blocked">Продавец заблокирован</div>}</td>
          <td>{listing.isAdmin ? <span className="admin-table-muted">Администратор защищён</span> : <form action={listing.blockedAt ? unblockUserAction : blockUserAction}>{context}<input type="hidden" name="userId" value={listing.sellerId} /><AdminActionButton pendingLabel="Сохраняем…" variant={listing.blockedAt ? 'secondary' : 'danger'} confirmMessage={listing.blockedAt ? undefined : `Заблокировать пользователя ${listing.sellerEmail}?`}>{listing.blockedAt ? 'Разблокировать' : 'Заблокировать пользователя'}</AdminActionButton></form>}</td>
        </tr>)}</DataTable>}
        {tab === 'reports' && <DataTable label="Жалобы на профили и контент" columns={['На что', 'Автор контента', 'Автор жалобы', 'Причина', 'Комментарий', 'Дата', 'Статус', 'Действия']}>{data.reports.map(report => <tr key={report.id}>
          <td>{report.contentKind ? <>{report.pagePath ? <Link href={report.pagePath}>{CONTENT_REPORT_KINDS[report.contentKind]}</Link> : CONTENT_REPORT_KINDS[report.contentKind]}{report.excerpt && <RecordText text={report.excerpt} />}</> : 'Профиль'}</td>
          <td>{report.targetUsername ? <Link href={`/profile/${report.targetUsername}`}>@{report.targetUsername}</Link> : report.targetName}</td>
          <td>{report.authorUsername ? <Link href={`/profile/${report.authorUsername}`}>@{report.authorUsername}</Link> : report.authorName}</td>
          <td>{REPORT_REASONS[report.reason]}</td><td><RecordText text={report.comment} /></td><td>{formatDate(report.createdAt)}</td>
          <td><span className="admin-status">{report.status === 'open' ? 'Новая' : report.status === 'resolved' ? 'Рассмотрена' : 'Отклонена'}</span></td>
          <td>{report.status === 'open' && <form action={reviewProfileReportAction}>{context}<input type="hidden" name="reportId" value={report.id} /><AdminActionButton name="status" value="resolved" pendingLabel="Сохраняем…">Рассмотрена</AdminActionButton><AdminActionButton name="status" value="dismissed" pendingLabel="Сохраняем…">Отклонить</AdminActionButton></form>}</td>
        </tr>)}</DataTable>}
        {tab === 'users' && <DataTable label="Участники" columns={['Участник', 'Активность', 'Регистрация', 'Статус', '']}>{data.users.map(user => {
          const label = user.username ? `@${user.username}` : user.name || 'участника';
          return <tr key={user.id}>
            <td><div className="admin-member">
              <span className="admin-member-avatar" data-frame={user.frame}>{user.avatarId ? <Image src={`/api/profile-images/${user.avatarId}`} width={44} height={44} unoptimized alt="" /> : <span aria-hidden="true">{(user.username ?? user.name ?? '?').slice(0, 1).toUpperCase()}</span>}<AvatarFrame frame={user.frame} /></span>
              <div className="admin-member-text">
                <div className="admin-member-name">{user.username ? <Link href={`/profile/${user.username}`}>{user.name || `@${user.username}`}</Link> : <strong>{user.name || 'Без имени'}</strong>}{user.tag && <span className="profile-tag" data-tag={user.tag}>{profileTagLabel(user.tag)}</span>}<LevelChip level={experienceLevel(user.xp).level} /></div>
                <span className="admin-member-meta">{user.username && <>@{user.username}</>}{user.email !== `@${user.username}` && <>{user.username && ' · '}{user.email}</>}</span>
              </div>
            </div></td>
            <td><span className="admin-member-stats"><span title="Отзывы"><AdminIcon section="reviews" />{user.reviewCount}</span><span title="Тирлисты"><AdminIcon section="tierlists" />{user.tierListCount}</span><span title="Комментарии и записи"><AdminIcon section="comments" />{user.commentCount}</span><span title="Опыт">{number(user.xp)} XP</span></span></td>
            <td>{formatDate(user.createdAt)}</td>
            <td><span className={`admin-status ${user.role ? 'admin-status-admin' : user.blockedAt ? 'admin-status-blocked' : user.frozenUntil ? 'admin-status-frozen' : 'admin-status-active'}`}>{user.role ? SITE_ROLE_LABELS[user.role] : user.blockedAt ? 'Заблокирован' : user.frozenUntil ? `Заморожен до ${formatDate(user.frozenUntil)}` : 'Активен'}</span></td>
            <td className="admin-member-actions">{user.role ? <span className="admin-table-muted">Команда</span> : <AdminMemberMenu canDelete={admin.role === 'admin'} context={{ query, tab, page: data.page }}
              member={{ id: user.id, label, username: user.username, blocked: Boolean(user.blockedAt), frozen: Boolean(user.frozenUntil), tierLists: user.tierListCount, comments: user.commentCount }} />}</td>
          </tr>;
        })}</DataTable>}
        {tab === 'admins' && <DataTable label="Администраторы" columns={['Email', 'Роль', 'Добавлен', 'Кем', 'Действия']}>{data.admins.map(entry => <tr key={entry.email}><td>{entry.email}</td><td><span className={`admin-status admin-status-${entry.role}`}>{entry.isOwner ? 'Владелец' : SITE_ROLE_LABELS[entry.role]}</span></td><td>{formatDate(entry.createdAt)}</td><td>{entry.addedByName ?? '—'}</td><td>{!entry.isOwner && entry.email !== admin.email ? <div className="admin-table-actions"><form action={setAdminRoleAction}>{context}<input type="hidden" name="email" value={entry.email} /><input type="hidden" name="role" value={entry.role === 'admin' ? 'moderator' : 'admin'} /><AdminActionButton pendingLabel="Меняем…" confirmMessage={entry.role === 'admin' ? `Сделать ${entry.email} модератором? Он потеряет доступ к администраторам, конкурсам, кампаниям и почте участников.` : `Сделать ${entry.email} администратором с полным доступом?`}>{entry.role === 'admin' ? 'Сделать модератором' : 'Сделать администратором'}</AdminActionButton></form><form action={removeAdminAction}>{context}<input type="hidden" name="email" value={entry.email} /><AdminActionButton pendingLabel="Удаляем…" variant="danger" confirmMessage={`Убрать доступ у ${entry.email}?`}>Убрать доступ</AdminActionButton></form></div> : <span className="admin-table-muted">Защищён</span>}</td></tr>)}</DataTable>}
      </>}
      {data.total > 0 && <nav className="admin-table-pagination" aria-label="Страницы записей"><span>{(data.page - 1) * ADMIN_PAGE_SIZE + 1}–{Math.min(data.page * ADMIN_PAGE_SIZE, data.total)} из {number(data.total)}</span><div>{data.page > 1 && <Link href={adminHref(tab, query, data.page - 1)}>← Назад</Link>}<span>{data.page} / {pages}</span>{data.page < pages && <Link href={adminHref(tab, query, data.page + 1)}>Далее →</Link>}</div></nav>}
    </section>}
  </AdminShell>;
}
