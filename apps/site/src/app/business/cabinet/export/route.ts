import { headers } from 'next/headers';
import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { getBusinessCards, getBusinessSearch, getCabinet, listBusinessReviews, logBusiness } from '@/lib/business';
import { getCompetitors } from '@/lib/business-competitors';
import { csvCell } from '@/lib/business-fields';
import { hasFeature } from '@/lib/business-plans';

export const dynamic = 'force-dynamic';

const day = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeZone: 'Europe/Moscow' });
const SCOPES: Record<string, string> = { catalog: 'Каталог', stores: 'Магазины', market: 'Маркет' };
const share = (part: number, whole: number) => whole ? `${(part / whole * 100).toFixed(1).replace('.', ',')}%` : '';
const decimal = (value: number | null) => value === null ? '' : String(value).replace('.', ',');

/** The tables of one cabinet section as CSV rows (header first). */
async function table(kind: string, businessId: string): Promise<string[][] | null> {
  if (kind === 'reviews') {
    const { items } = await listBusinessReviews(businessId, { limit: 5000 });
    return [['Дата', 'Напиток', 'Автор', 'Ник', 'Вкус', 'Дизайн', 'Отзыв', 'Ответ компании'],
      ...items.map(item => [day.format(item.createdAt), item.name, item.authorName, item.author ?? '', String(item.taste), String(item.design), item.text, item.reply?.text ?? ''])];
  }
  if (kind === 'search') {
    const data = await getBusinessSearch(businessId, undefined, 1000);
    return [['Запрос', 'Поисков за 30 дней', 'Результатов в среднем', 'Бренд в запросе', 'Где искали', 'Последний поиск'],
      ...data.top.map(item => [item.query, String(item.count), String(item.results), item.named ? 'да' : 'нет', item.scopes.map(scope => SCOPES[scope] ?? scope).join(', '), day.format(item.lastAt)])];
  }
  if (kind === 'cards') {
    const data = await getBusinessCards(businessId);
    return [['Напиток', 'Просмотры за 30 дней', 'Переходы в магазины', 'Конверсия', 'Чаще в магазин'],
      ...data.items.map(item => [item.name, String(item.views), String(item.clicks), share(item.clicks, item.views), item.retailer ?? '']),
      [], ['Магазин', 'Переходы за 30 дней'], ...data.retailers.map(item => [item.retailer, String(item.count)])];
  }
  if (kind === 'competitors') {
    const data = await getCompetitors(businessId);
    const sides = [...(data.own ? [data.own] : []), ...data.rivals];
    return [['Бренд', 'Ваш', 'Напитков в каталоге', 'Отзывов', 'Отзывов за 30 дней', 'Оценка', 'Вкус', 'Дизайн', 'Лайки в дейтинге', 'Свайпов', 'Поиски за 30 дней', 'Просмотры за 30 дней', 'Переходы за 30 дней', 'Цена 0,5 л, ₽'],
      ...sides.map(item => [item.label, item.own ? 'да' : '', String(item.drinks), String(item.reviews), String(item.reviews30), decimal(item.score), decimal(item.taste), decimal(item.design),
        item.likeShare === null ? '' : share(item.likeShare, 1), String(item.swipes), String(item.searches30), String(item.views30), String(item.clicks30), item.price500 === null ? '' : String(item.price500)])];
  }
  return null;
}

/**
 * «Экспорт CSV» of the cabinet for Excel (BOM, semicolons, formulas defused by `csvCell`): `?kind=reviews` (default —
 * every review of the approved drinks, up to 5000, with the company's reply), `search`, `cards` or `competitors`. Any
 * member of an approved company, analysts included; each download is written to the team's log.
 */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response('Войдите в аккаунт', { status: 401 });
  const business = (await getCabinet(session.user.id))?.business;
  if (!business || business.status !== 'approved') return new Response('Кабинет компании не подтверждён', { status: 403 });
  if (!hasFeature(business, 'export')) return new Response('Экспорт CSV — в тарифах «Бренд» и «Сеть»', { status: 403 });
  const kind = request.nextUrl.searchParams.get('kind') ?? 'reviews';
  const rows = await table(kind, business.id);
  if (!rows) return new Response('Неизвестная выгрузка', { status: 400 });
  await logBusiness(business.id, session.user.id, 'export', { reviews: 'Отзывы', search: 'Поиск', cards: 'Карточки', competitors: 'Конкуренты' }[kind] ?? kind);
  const body = '﻿' + rows.map(row => row.map(csvCell).join(';')).join('\r\n');
  return new Response(body, { headers: {
    'content-type': 'text/csv; charset=utf-8',
    'content-disposition': `attachment; filename="canrush-${kind}-${new Date().toISOString().slice(0, 10)}.csv"`,
    'cache-control': 'private, no-store',
  } });
}
