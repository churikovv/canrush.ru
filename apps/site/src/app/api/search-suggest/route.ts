import { SUGGEST_MAX_QUERY } from '@/lib/search-suggest-fields';
import { searchSuggestions } from '@/lib/search-suggest';

export const runtime = 'nodejs';

/**
 * Подсказки поля поиска каталога: бренды к набранному. Каталог публичный и общий для всех, поэтому ответ кешируется на
 * пять минут.
 */
export async function GET(request: Request) {
  const query = (new URL(request.url).searchParams.get('q') ?? '').slice(0, SUGGEST_MAX_QUERY);
  const items = query.trim() ? await searchSuggestions(query).catch(() => []) : [];
  return Response.json({ items }, {
    headers: { 'Cache-Control': 'public, max-age=300' },
  });
}
