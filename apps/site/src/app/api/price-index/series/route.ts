import { NextResponse, type NextRequest } from 'next/server';
import { getPriceIndexData, resolveIndexFilter, seriesFor } from '@/lib/price-index';

/**
 * The 90-day line of the price index for the page's filter (`?city=&brand=`), asked when «90 дней» is opened: the
 * lines of every city × brand are too many to send with the page. Public data, cached for ten minutes.
 */
export async function GET(request: NextRequest) {
  const data = await getPriceIndexData().catch(() => null);
  if (!data) return NextResponse.json({ series: null }, { headers: { 'Cache-Control': 'no-store' } });
  const params = request.nextUrl.searchParams;
  const { filter } = resolveIndexFilter({ city: params.get('city') ?? undefined, brand: params.get('brand') ?? undefined }, data);
  return NextResponse.json({ series: await seriesFor(data, filter) }, { headers: { 'Cache-Control': 'public, max-age=600' } });
}
