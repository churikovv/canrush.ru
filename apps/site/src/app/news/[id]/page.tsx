import '@/styles/shared.css';
import '@/styles/news.css';
import type { Metadata } from 'next';
import Image from 'next/image';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { ArticleLikeButton, ArticleModeration, ArticleOwnerActions, ArticleSentToast } from '@/components/article-actions';
import { ContentReportButton } from '@/components/content-report-button';
import { MoreActions } from '@/components/more-actions';
import { StaffDeleteMenuItem } from '@/components/staff-delete-button';
import { ArticleByline, articleDate } from '@/components/article-card';
import { ArticleContent, articlePhotos } from '@/components/article-content';
import { ArticleGallery } from '@/components/article-gallery';
import { BrandShell } from '@/components/brand-shell';
import { FormAlert } from '@/components/form-alert';
import { ProfileBackButton } from '@/components/profile-back-button';
import { ProfileNavigation } from '@/components/profile-navigation';
import { isSiteStaffEmail } from '@/lib/admin';
import { ARTICLE_STATUS_LABELS, articleSummary, readingMinutes } from '@/lib/article-fields';
import { articleDrinks, getArticle, type Article } from '@/lib/articles';
import { SITE_NAME, SITE_URL } from '@/lib/seo';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const article = await getArticle(id, null);
  if (!article) return { title: 'Статья', robots: { index: false, follow: false } };
  const description = articleSummary(article.blocks, 160);
  const image = article.coverId ? `${SITE_URL}/api/article-images/${article.coverId}` : undefined;
  return {
    title: article.title, description, alternates: { canonical: `/news/${article.id}` },
    openGraph: {
      type: 'article', locale: 'ru_RU', siteName: SITE_NAME, url: `/news/${article.id}`, title: article.title, description,
      publishedTime: article.publishedAt?.toISOString(), modifiedTime: article.updatedAt.toISOString(),
      authors: article.author.username ? [`${SITE_URL}/profile/${article.author.username}`] : undefined, ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: { card: image ? 'summary_large_image' : 'summary', title: article.title, description },
  };
}

/** Structured data for search engines: a published article with its author, dates and cover. */
function articleJsonLd(article: Article) {
  return JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Article', headline: article.title, description: articleSummary(article.blocks, 160),
    datePublished: article.publishedAt?.toISOString(), dateModified: article.updatedAt.toISOString(), mainEntityOfPage: `${SITE_URL}/news/${article.id}`,
    ...(article.coverId ? { image: [`${SITE_URL}/api/article-images/${article.coverId}`] } : {}),
    author: { '@type': 'Person', name: article.author.name || article.author.username, ...(article.author.username ? { url: `${SITE_URL}/profile/${article.author.username}` } : {}) },
    publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
  }).replace(/</g, '\\u003c');
}

/** An article: published ones for everybody; drafts and requests for their author and the team, with a status note. */
export default async function ArticlePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sent?: string }> }) {
  const [{ id }, { sent }, session] = await Promise.all([params, searchParams, auth.api.getSession({ headers: await headers() })]);
  const article = await getArticle(id, session?.user.id ?? null);
  if (!article) notFound();
  const own = session?.user.id === article.author.id;
  const staff = session ? await isSiteStaffEmail(session.user.email) : false;
  const drinks = await articleDrinks(article.blocks);
  return <BrandShell headerAction={<ProfileNavigation active="news" />}>
    <article className="news-article">
      <ProfileBackButton href="/news" label="Новости" />
      {article.status === 'published' && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: articleJsonLd(article) }} />}
      {sent && article.status === 'pending' && <ArticleSentToast />}
      {article.status !== 'published' && <FormAlert tone={article.status === 'rejected' ? 'warning' : 'success'} title={ARTICLE_STATUS_LABELS[article.status]}>
        {article.status === 'pending' ? 'Статью видите только вы и команда, пока её не проверят.'
          : article.status === 'rejected' ? article.moderationNote || 'Статью вернули на доработку.'
          : 'Черновик видите только вы.'}
      </FormAlert>}
      <ArticleGallery photos={articlePhotos(article.blocks, article.coverId)}>
      {article.coverId && <figure className="news-article-cover">
        <button type="button" className="article-photo" data-photo={article.coverId} aria-label="Открыть обложку">
          {/* eslint-disable-next-line @next/next/no-img-element -- served from the database */}
          <img src={`/api/article-images/${article.coverId}`} alt="" />
        </button>
      </figure>}
      <h1>{article.title || 'Без названия'}</h1>
      <div className="news-article-meta">
        <ArticleByline author={article.author}>{article.publishedAt ? articleDate(article.publishedAt) : articleDate(article.updatedAt)} · {readingMinutes(article.blocks)} мин чтения</ArticleByline>
        {article.status === 'published' && <div className="news-article-actions">
          <ArticleLikeButton id={article.id} likes={article.likes} liked={article.liked} own={own} signedIn={Boolean(session)} />
          {session && !own && <MoreActions label="Действия со статьёй">
            <ContentReportButton kind="article" id={article.id} variant="menuitem" />
            {staff && <StaffDeleteMenuItem kind="article" id={article.id} after="/news" />}
          </MoreActions>}
        </div>}
      </div>
      <ArticleContent blocks={article.blocks} drinks={drinks} />
      </ArticleGallery>
      {article.telegramChannel && <div className="review-author-channel news-article-channel"><span>Канал автора</span>
        <a className="review-item-channel" href={`https://t.me/${article.telegramChannel}`} target="_blank" rel="noopener noreferrer" aria-label={`Telegram-канал автора @${article.telegramChannel} (откроется в новой вкладке)`}>
          <Image src="/brand/icons/telegram.svg" width={18} height={18} alt="" /><span>@{article.telegramChannel}</span>
        </a>
      </div>}
      {staff && article.status === 'pending' && <ArticleModeration id={article.id} version={article.version} />}
      {(own || staff) && <ArticleOwnerActions id={article.id} status={article.status} own={own} />}
    </article>
  </BrandShell>;
}
