import '@/styles/shared.css';
import '@/styles/news.css';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { ArticleEditor } from '@/components/article-editor';
import { BrandShell } from '@/components/brand-shell';
import { ProfileNavigation } from '@/components/profile-navigation';
import { ARTICLE_ID_PATTERN } from '@/lib/article-fields';
import { profileChannel } from '@/lib/articles';
import { auth } from '@/lib/auth';
import { storeDrinkOptions } from '@/lib/store-catalog';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Новая статья', robots: { index: false, follow: false } };

/**
 * A blank editor: the draft is created by its first autosave and the address gets `?id=` (the same route, so the editor
 * stays mounted); opened again with that id, the draft continues in its own editor.
 */
export default async function NewArticlePage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/sign-in');
  const { id } = await searchParams;
  if (id && ARTICLE_ID_PATTERN.test(id)) redirect(`/news/${id}/edit`);
  return <BrandShell headerAction={<ProfileNavigation active="news" />}>
    <ArticleEditor initial={{ id: null, title: '', blocks: [], coverId: null, version: null }} options={await storeDrinkOptions()} profileChannel={await profileChannel(session.user.id)} />
  </BrandShell>;
}
