import Link from 'next/link';
import {
  addAdminAction,
  blockUserAction,
  deleteAdminReviewAction,
  deleteAdminTierListAction,
  removeAdminAction,
  unblockUserAction,
} from '@/app/admin/actions';
import { AdminActionButton } from '@/components/admin-action-button';
import type { AdminDashboardData, SiteAdminIdentity } from '@/lib/admin';
import { flavorName } from '@/lib/catalog-query';

interface AdminDashboardProps {
  admin: SiteAdminIdentity;
  data: AdminDashboardData;
  query: string;
  notice?: string;
  error?: string;
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' }).format(value);
}

function HiddenQuery({ query }: { query: string }) {
  return query ? <input type="hidden" name="query" value={query} /> : null;
}

function EmptyResult({ query }: { query: string }) {
  return (
    <div className="admin-empty-result">
      <strong>{query ? 'Ничего не найдено' : 'Здесь пока пусто'}</strong>
      <span>{query ? 'Измените запрос или очистите поиск.' : 'Записи появятся после первых действий пользователей.'}</span>
    </div>
  );
}

export function AdminDashboard({ admin, data, query, notice, error }: AdminDashboardProps) {
  return (
    <div className="admin-layout ym-hide-content ym-disable-clickmap">
      <header className="admin-heading">
        <div>
          <p>Доступ: {admin.email}</p>
          <h1>Управление сайтом</h1>
          <span>Модерация пользователей, тирлистов и отзывов.</span>
        </div>
        <nav className="admin-section-nav" aria-label="Разделы админки">
          <a href="#admin-users">Участники</a>
          <a href="#admin-tierlists">Тирлисты</a>
          <a href="#admin-reviews">Отзывы</a>
          <a href="#admin-team">Админы</a>
        </nav>
      </header>

      <form className="admin-search" method="get" role="search">
        <label htmlFor="admin-search-input">Поиск по имени, email или содержимому</label>
        <div>
          <input
            id="admin-search-input"
            name="q"
            type="search"
            defaultValue={query}
            maxLength={80}
            placeholder="Например, @username или название тирлиста"
          />
          <button type="submit">Найти</button>
          {query ? <Link href="/admin">Сбросить</Link> : null}
        </div>
      </form>

      {notice ? <div className="admin-feedback admin-feedback-success" role="status">{notice}</div> : null}
      {error ? <div className="admin-feedback admin-feedback-error" role="alert">{error}</div> : null}

      <section className="admin-section" id="admin-users" aria-labelledby="admin-users-title">
        <div className="admin-section-heading">
          <div>
            <h2 id="admin-users-title">Участники</h2>
            <p>Блокировка запрещает создавать и изменять отзывы и тирлисты.</p>
          </div>
          <span>{data.users.length} показано</span>
        </div>
        {data.users.length > 0 ? (
          <ul className="admin-record-list">
            {data.users.map((user) => (
              <li className="admin-record admin-user-record" key={user.id}>
                <div className="admin-record-primary">
                  <strong>{user.name || user.username || 'Без имени'}</strong>
                  <span>{user.username ? `@${user.username} · ` : ''}{user.email}</span>
                </div>
                <div className="admin-record-meta">
                  <span>{user.tierListCount} тирлистов</span>
                  <span>{user.reviewCount} отзывов</span>
                  <span>С {formatDate(user.createdAt)}</span>
                </div>
                <div className="admin-record-state">
                  {user.isAdmin ? (
                    <span className="admin-status admin-status-admin">Администратор</span>
                  ) : user.blockedAt ? (
                    <span className="admin-status admin-status-blocked">Заблокирован {formatDate(user.blockedAt)}</span>
                  ) : (
                    <span className="admin-status admin-status-active">Активен</span>
                  )}
                </div>
                <div className="admin-record-actions">
                  {!user.isAdmin && user.blockedAt ? (
                    <form action={unblockUserAction}>
                      <input type="hidden" name="userId" value={user.id} />
                      <HiddenQuery query={query} />
                      <AdminActionButton pendingLabel="Разблокируем…">Разблокировать</AdminActionButton>
                    </form>
                  ) : null}
                  {!user.isAdmin && !user.blockedAt ? (
                    <form action={blockUserAction}>
                      <input type="hidden" name="userId" value={user.id} />
                      <HiddenQuery query={query} />
                      <AdminActionButton
                        pendingLabel="Блокируем…"
                        variant="danger"
                        confirmMessage={`Заблокировать ${user.email}? Пользователь не сможет публиковать отзывы и тирлисты.`}
                      >
                        Заблокировать
                      </AdminActionButton>
                    </form>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : <EmptyResult query={query} />}
      </section>

      <section className="admin-section" id="admin-tierlists" aria-labelledby="admin-tierlists-title">
        <div className="admin-section-heading">
          <div>
            <h2 id="admin-tierlists-title">Тирлисты</h2>
            <p>Удаление безвозвратно убирает список и все его позиции.</p>
          </div>
          <span>{data.tierLists.length} показано</span>
        </div>
        {data.tierLists.length > 0 ? (
          <ul className="admin-record-list">
            {data.tierLists.map((list) => (
              <li className="admin-record admin-content-record" key={list.id}>
                <div className="admin-record-primary">
                  {list.status === 'published' ? (
                    <Link href={`/tierlists/${list.slug}`}>{list.title}</Link>
                  ) : (
                    <strong>{list.title}</strong>
                  )}
                  <span>{list.authorName} · {list.authorEmail}</span>
                </div>
                <div className="admin-record-meta">
                  <span>{list.itemCount} позиций</span>
                  <span>{list.status === 'published' ? 'Опубликован' : 'Черновик'}</span>
                  <span>{formatDate(list.updatedAt)}</span>
                </div>
                <div className="admin-record-actions">
                  <form action={deleteAdminTierListAction}>
                    <input type="hidden" name="slug" value={list.slug} />
                    <HiddenQuery query={query} />
                    <AdminActionButton
                      pendingLabel="Удаляем…"
                      variant="danger"
                      confirmMessage={`Удалить тирлист «${list.title}»? Восстановить его не получится.`}
                    >
                      Удалить тирлист
                    </AdminActionButton>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        ) : <EmptyResult query={query} />}
      </section>

      <section className="admin-section" id="admin-reviews" aria-labelledby="admin-reviews-title">
        <div className="admin-section-heading">
          <div>
            <h2 id="admin-reviews-title">Отзывы и комментарии</h2>
            <p>Проверяйте текст и удаляйте нарушения вручную.</p>
          </div>
          <span>{data.reviews.length} показано</span>
        </div>
        {data.reviews.length > 0 ? (
          <ul className="admin-record-list">
            {data.reviews.map((review) => (
              <li className="admin-record admin-review-record" key={review.id}>
                <div className="admin-record-primary">
                  <strong>{review.brand}, {flavorName(review.flavor)}</strong>
                  <span>{review.authorName} · {review.authorEmail} · {review.score.toFixed(1)} из 5</span>
                </div>
                <p className="admin-review-text">{review.text}</p>
                <div className="admin-record-meta"><span>{formatDate(review.createdAt)}</span></div>
                <div className="admin-record-actions">
                  <form action={deleteAdminReviewAction}>
                    <input type="hidden" name="reviewId" value={review.id} />
                    <HiddenQuery query={query} />
                    <AdminActionButton
                      pendingLabel="Удаляем…"
                      variant="danger"
                      confirmMessage="Удалить этот отзыв? Восстановить его не получится."
                    >
                      Удалить отзыв
                    </AdminActionButton>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        ) : <EmptyResult query={query} />}
      </section>

      <section className="admin-section admin-team-section" id="admin-team" aria-labelledby="admin-team-title">
        <div className="admin-section-heading">
          <div>
            <h2 id="admin-team-title">Администраторы</h2>
            <p>Доступ включается по email, аккаунт можно создать позже.</p>
          </div>
        </div>
        <form className="admin-add-form" action={addAdminAction}>
          <label htmlFor="admin-email">Email нового администратора</label>
          <div>
            <input id="admin-email" name="email" type="email" maxLength={320} autoComplete="email" required />
            <HiddenQuery query={query} />
            <AdminActionButton pendingLabel="Добавляем…" variant="primary">Добавить администратора</AdminActionButton>
          </div>
        </form>
        <ul className="admin-list">
          {data.admins.map((entry) => (
            <li key={entry.email}>
              <div>
                <strong>{entry.email}</strong>
                <span>{entry.isOwner ? 'Владелец' : `Добавлен ${formatDate(entry.createdAt)}`}</span>
              </div>
              {!entry.isOwner && entry.email !== admin.email ? (
                <form action={removeAdminAction}>
                  <input type="hidden" name="email" value={entry.email} />
                  <HiddenQuery query={query} />
                  <AdminActionButton
                    pendingLabel="Удаляем доступ…"
                    variant="danger"
                    confirmMessage={`Убрать доступ администратора у ${entry.email}?`}
                  >
                    Убрать доступ
                  </AdminActionButton>
                </form>
              ) : <span className="admin-protected-label">Доступ защищён</span>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
