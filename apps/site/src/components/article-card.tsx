import type { ReactNode } from 'react';
import Image from 'next/image';
import { ArticleDraftDelete, ArticleLikeButton } from '@/components/article-actions';
import Link from '@/components/navigation-progress';
import { ARTICLE_STATUS_LABELS } from '@/lib/article-fields';
import type { ArticleAuthor, ArticleCard as Card } from '@/lib/articles';

const date = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Europe/Moscow' });
export const articleDate = (value: Date) => date.format(value);

/** The author's avatar (or initial) and name, as on the article page and in cards. */
export function ArticleByline({ author, children }: { author: ArticleAuthor; children?: ReactNode }) {
  const name = author.name || author.username || 'Участник';
  const avatar = author.avatarId
    // eslint-disable-next-line @next/next/no-img-element -- avatars are served from the database
    ? <img src={`/api/profile-images/${author.avatarId}`} alt="" width={32} height={32} />
    : <span aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>;
  return <span className="article-byline">
    <span className="article-byline-avatar">{avatar}</span>
    <span className="article-byline-text">{author.username ? <Link href={`/profile/${author.username}`}>{name}</Link> : <b>{name}</b>}{children && <small>{children}</small>}</span>
  </span>;
}

/** A card in «Новости»: cover, title, lead and byline; the author's own cards show their status. */
export function ArticleCard({ article, own = false, viewerId = null }: { article: Card; own?: boolean; viewerId?: string | null }) {
  const href = own && article.status !== 'published' && article.status !== 'pending' ? `/news/${article.id}/edit` : `/news/${article.id}`;
  return <article className="article-card" data-status={own ? article.status : undefined}>
    <Link className="article-card-link" href={href}>
      {article.coverId
        // eslint-disable-next-line @next/next/no-img-element -- served from the database
        ? <img className="article-card-cover" src={`/api/article-images/${article.coverId}?thumb`} alt="" loading="lazy" />
        : <span className="article-card-cover is-empty" aria-hidden="true">📰</span>}
      <span className="article-card-body">
        {own && <span className="article-status" data-status={article.status}>{ARTICLE_STATUS_LABELS[article.status]}</span>}
        <strong>{article.title || 'Без названия'}</strong>
        {article.summary && <span className="article-card-summary">{article.summary}</span>}
      </span>
    </Link>
    {!own && <div className="article-card-foot">
      <ArticleByline author={article.author}>{article.publishedAt ? articleDate(article.publishedAt) : ''} · {article.minutes} мин</ArticleByline>
      <div className="article-card-actions">
        {article.telegramChannel && <a className="article-card-channel" href={`https://t.me/${article.telegramChannel}`} target="_blank" rel="noopener noreferrer"
          aria-label={`Telegram-канал автора @${article.telegramChannel} (откроется в новой вкладке)`} title={`@${article.telegramChannel}`}>
          <Image src="/brand/icons/telegram.svg" width={20} height={20} alt="" />
        </a>}
        <ArticleLikeButton id={article.id} likes={article.likes} liked={article.liked} own={viewerId === article.author.id} signedIn={Boolean(viewerId)} />
      </div>
    </div>}
    {own && article.status === 'rejected' && article.moderationNote && <p className="article-card-note">Модератор: {article.moderationNote}</p>}
    {own && (article.status === 'draft' || article.status === 'rejected') && <ArticleDraftDelete id={article.id} />}
  </article>;
}
