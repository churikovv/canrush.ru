import '@/styles/shared.css';
import '@/styles/pass.css';
import '@/styles/hunt.css';
import { headers } from 'next/headers';
import { HuntScreen } from '@/components/hunt-screen';
import { auth } from '@/lib/auth';
import { getHunt } from '@/lib/hunt';
import { seoMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export const metadata = seoMetadata({
  title: 'Охота за ценниками',
  description: 'CanRush платит за добавление магазинов: собирайте ценники за полные магазины и меняйте их на рубли и мерч, 1 ценник = 1 ₽.',
  path: '/hunt',
});

/** Весь экран — витрина, как у сезонного пропуска: без шапки и таб бара сайта, выход — кнопкой на самом экране. */
export default async function HuntPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  return <HuntScreen initial={await getHunt(session?.user.id ?? null)} signedIn={Boolean(session)} />;
}
