import '@/styles/shared.css';
import '@/styles/news.css';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { ArticleOwnerActions } from '@/components/article-actions';
import { ArticleEditor } from '@/components/article-editor';
import { BrandShell } from '@/components/brand-shell';
import { FormAlert } from '@/components/form-alert';
import { ProfileBackButton } from '@/components/profile-back-button';
import { ProfileNavigation } from '@/components/profile-navigation';
import { getArticle, profileChannel } from '@/lib/articles';
import { auth } from '@/lib/auth';
import { storeDrinkOptions } from '@/lib/store-catalog';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Редактор статьи', robots: { index: false, follow: false } };

/** The author's editor. A pending or published article is taken back to drafts first, so readers never see half an edit. */
export default async function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/sign-in');
  const { id } = await params;
  const article = await getArticle(id, session.user.id);
  if (!article || article.author.id !== session.user.id) notFound();
  if (article.status === 'pending' || article.status === 'published') return <BrandShell headerAction={<ProfileNavigation active="news" />}>
    <div className="news-article">
      <ProfileBackButton href={`/news/${article.id}`} label="К статье" />
      <FormAlert tone="warning" title={article.status === 'pending' ? 'Статья на проверке' : 'Статья опубликована'}>
        {article.status === 'pending' ? 'Чтобы что-то поправить, верните её в черновики — она уйдёт из очереди, а потом отправите снова.'
          : 'Чтобы править, верните её в черновики: до повторной проверки она скроется из «Новостей».'}
      </FormAlert>
      <ArticleOwnerActions id={article.id} status={article.status} own />
    </div>
  </BrandShell>;
  return <BrandShell headerAction={<ProfileNavigation active="news" />}>
    <ArticleEditor options={await storeDrinkOptions()} profileChannel={await profileChannel(session.user.id)} initial={{
      id: article.id, title: article.title, blocks: article.blocks, coverId: article.coverId, version: article.version, telegramChannel: article.telegramChannel,
      moderationNote: article.status === 'rejected' ? article.moderationNote : undefined,
    }} />
  </BrandShell>;
}
