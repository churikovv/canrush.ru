import '@/styles/shared.css';
import '@/styles/business-cabinet.css';
import '@/styles/brand-materials.css';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { BrandPoster } from '@/components/brand-poster';
import { PrintButton } from '@/components/brand-materials-client';
import { businessHref } from '@/components/business-shell';
import Link from '@/components/navigation-progress';
import { auth } from '@/lib/auth';
import { getCabinet } from '@/lib/business';
import { companyTargets, targetCovers, targetRating } from '@/lib/brand-materials';
import { pickTarget, posterFormat, targetParams } from '@/lib/brand-materials-fields';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'QR-плакат', robots: { index: false, follow: false } };

/**
 * The print page of «QR и значок»: the sheet alone, A4 or eight labels, with a bar to switch the format and print. The
 * company prints only its own brands' drinks; the print takes nothing but the sheet (`brand-materials.css`).
 */
export default async function PosterPage({ searchParams }: { searchParams: Promise<{ drink?: string; brand?: string; format?: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/sign-in?for=business');
  const cabinet = await getCabinet(session.user.id);
  if (!cabinet || cabinet.business.status !== 'approved') redirect(businessHref('materials'));
  const params = await searchParams;
  const target = pickTarget(await companyTargets(cabinet.business.id), params);
  if (!target) redirect(businessHref('materials'));
  const format = posterFormat(params.format);
  const [covers, rating] = await Promise.all([targetCovers(target, cabinet.business.id), targetRating(target)]);
  const keep = targetParams(target);
  const href = (next: string) => `/business/cabinet/poster?${new URLSearchParams({ ...keep, format: next })}`;
  return <main className="poster-page bc-apply">
    <div className="poster-toolbar">
      <Link className="bc-button is-outline" href={businessHref('materials', keep)}>← К материалам</Link>
      <nav className="bc-segments" aria-label="Формат">
        <Link href={href('a4')} aria-current={format === 'a4' ? 'page' : undefined}>Плакат A4</Link>
        <Link href={href('labels')} aria-current={format === 'labels' ? 'page' : undefined}>Наклейки · 8</Link>
      </nav>
      <PrintButton />
    </div>
    <p className="poster-tip">{format === 'a4'
      ? 'Лист A4, книжная ориентация, масштаб 100%. В настройках печати включите «Фон» или «Цвета фона», чтобы синяя полоса вышла на бумаге.'
      : 'Восемь наклеек на листе A4: печатайте в масштабе 100% и режьте по пунктиру. Подойдёт и самоклеящаяся бумага.'}</p>
    <div className="poster-print"><BrandPoster target={target} covers={covers} rating={rating} format={format} /></div>
  </main>;
}
