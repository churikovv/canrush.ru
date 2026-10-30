import '@/styles/shared.css';
import '@/styles/news.css';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { ArticleCard } from '@/components/article-card';
import { BrandShell } from '@/components/brand-shell';
import Link from '@/components/navigation-progress';
import { ProfileNavigation } from '@/components/profile-navigation';
import { listOwnArticles, listPublishedArticles } from '@/lib/articles';
import { auth } from '@/lib/auth';
import { seoMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = seoMetadata({ title: 'Новости', description: 'Статьи участников CanRush об энергетиках: обзоры, сравнения и новинки.', path: '/news' });
const PAGE = 12;

/** «Новости»: published articles of members, newest first; signed-in members also see their own drafts and requests. */
export default async function NewsPage({ searchParams }: { searchParams: Promise<{ more?: string }> }) {
  const [session, { more }] = await Promise.all([auth.api.getSession({ headers: await headers() }), searchParams]);
  const pages = Math.min(10, Math.max(1, parseInt(more ?? '1', 10) || 1));
  const [{ items, hasMore }, own] = await Promise.all([listPublishedArticles(1, PAGE * pages, session?.user.id ?? null), session ? listOwnArticles(session.user.id) : []]);
  const mine = own.filter(article => article.status !== 'published');
  return <BrandShell headerAction={<ProfileNavigation active="news" />}>
    <div className="news-layout">
      <header className="news-hero">
        <div>
          <p className="news-kicker">Новости</p>
          <h1>Статьи сообщества</h1>
          <p>Обзоры, сравнения и новинки от участников. Каждая статья проходит проверку перед публикацией.</p>
        </div>
        <Link className="community-button news-write" href={session ? '/news/new' : '/sign-in'}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
          Написать статью
        </Link>
      </header>

      {mine.length > 0 && <section className="news-mine" aria-labelledby="news-mine-title">
        <h2 id="news-mine-title">Мои черновики и заявки</h2>
        <div className="news-mine-list">{mine.map(article => <ArticleCard key={article.id} article={article} own />)}</div>
      </section>}

      <section aria-labelledby="news-list-title">
        <h2 id="news-list-title" className="sr-only">Статьи</h2>
        {items.length ? <div className="news-grid">{items.map(article => <ArticleCard key={article.id} article={article} viewerId={session?.user.id ?? null} />)}</div>
          : <div className="news-empty">
            <span aria-hidden="true">📰</span>
            <strong>Пока ни одной статьи</strong>
            <p>Напишите первую: обзор любимого вкуса, сравнение брендов или находку в магазине.</p>
          </div>}
        {hasMore && <Link className="community-button community-button-secondary news-more" scroll={false} href={`/news?more=${pages + 1}`}>Показать ещё</Link>}
      </section>
    </div>
  </BrandShell>;
}
