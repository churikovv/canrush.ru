import '@/styles/shared.css';
import '@/styles/business-cabinet.css';
import '@/styles/admin.css';
import '@/styles/news.css';
import { AdminShell } from '@/components/admin-shell';
import { getAdminQueues } from '@/lib/admin-queues';
import Link from '@/components/navigation-progress';
import { requireSiteAdmin } from '@/lib/admin';
import { listArticlesForAdmin } from '@/lib/articles';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Статьи участников', robots: { index: false, follow: false } };
const when = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Moscow' });
const TABS = [
  { key: 'pending', label: 'На проверке', title: 'Статьи на проверке', subtitle: 'Откройте статью: под текстом — «Опубликовать» и «Вернуть на доработку» с комментарием автору.', empty: 'Все статьи проверены' },
  { key: 'published', label: 'Опубликованные', title: 'Опубликованные статьи', subtitle: 'Статьи в «Новостях». Удалить можно на странице статьи.', empty: 'Пока ничего не опубликовано' },
  { key: 'rejected', label: 'Отклонённые', title: 'Отклонённые статьи', subtitle: 'Статьи, возвращённые авторам на доработку.', empty: 'Отклонённых статей нет' },
] as const;

/** The queue of member articles: the decision itself is made on the article page, where the whole text is visible. */
export default async function AdminArticlesPage({ searchParams }: { searchParams: Promise<{ tab?: string; page?: string }> }) {
  const admin = await requireSiteAdmin();
  const params = await searchParams;
  const tab = TABS.find(item => item.key === params.tab) ?? TABS[0];
  const page = Math.min(1000, Math.max(1, parseInt(params.page ?? '1', 10) || 1));
  const { items, hasMore } = await listArticlesForAdmin(tab.key, page, 24);
  const href = (key: string, to = 1) => `/admin/articles?${new URLSearchParams({ ...(key !== 'pending' ? { tab: key } : {}), ...(to > 1 ? { page: String(to) } : {}) })}`;
  return <AdminShell queues={await getAdminQueues()} active="articles" email={admin.email} role={admin.role} title={tab.title} subtitle={tab.subtitle}>
      <nav className="market-filters" aria-label="Статьи">{TABS.map(item => <Link key={item.key} href={href(item.key)} aria-current={item.key === tab.key ? 'page' : undefined}>{item.label}</Link>)}</nav>
      {items.length ? <ul className="admin-article-list">{items.map(article => <li key={article.id}>
        <Link href={`/news/${article.id}`}>
          <strong>{article.title || 'Без названия'}</strong>
          <span>{article.summary}</span>
          <small>{article.author.username ? `@${article.author.username}` : article.author.name} · {article.minutes} мин · {when.format(article.updatedAt)}</small>
          {tab.key === 'rejected' && article.moderationNote && <small className="admin-article-note">Причина: {article.moderationNote}</small>}
        </Link>
      </li>)}</ul> : <div className="admin-data-panel"><div className="admin-empty-result"><strong>{tab.empty}</strong><span>Новые статьи появятся здесь после отправки.</span></div></div>}
      {(page > 1 || hasMore) && <nav className="admin-table-pagination" aria-label="Страницы статей"><span>Страница {page}</span><div>{page > 1 && <Link href={href(tab.key, page - 1)}>← Назад</Link>}{hasMore && <Link href={href(tab.key, page + 1)}>Далее →</Link>}</div></nav>}
    </AdminShell>
}
