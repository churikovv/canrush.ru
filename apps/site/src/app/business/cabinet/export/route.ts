import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getCabinet, listBusinessReviews } from '@/lib/business';
import { csvCell } from '@/lib/business-fields';

export const dynamic = 'force-dynamic';

const day = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeZone: 'Europe/Moscow' });

/** «Экспорт CSV»: every review of the company's approved drinks (up to 5000), for Excel — BOM, semicolons. */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response('Войдите в аккаунт', { status: 401 });
  const business = (await getCabinet(session.user.id))?.business;
  if (!business || business.status !== 'approved') return new Response('Кабинет компании не подтверждён', { status: 403 });
  const { items } = await listBusinessReviews(business.id, { limit: 5000 });
  const rows = [['Дата', 'Напиток', 'Автор', 'Ник', 'Вкус', 'Дизайн', 'Отзыв'],
    ...items.map(item => [day.format(item.createdAt), item.name, item.authorName, item.author ?? '', String(item.taste), String(item.design), item.text])];
  const body = '﻿' + rows.map(row => row.map(csvCell).join(';')).join('\r\n');
  return new Response(body, { headers: {
    'content-type': 'text/csv; charset=utf-8',
    'content-disposition': `attachment; filename="canrush-reviews-${new Date().toISOString().slice(0, 10)}.csv"`,
    'cache-control': 'private, no-store',
  } });
}
