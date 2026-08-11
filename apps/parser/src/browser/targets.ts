import type { SourceName } from '@canrush/shared';

/**
 * Представительные URL для diagnostics (doctor) и session:unlock — страницы,
 * на которых стоит антибот-защита нужного нам источника.
 */
export const SOURCE_CHECK_URLS: Record<SourceName, string> = {
  wildberries: 'https://www.wildberries.ru/catalog/0/search.aspx?search=энергетик',
  ozon: 'https://www.ozon.ru/search/?text=энергетик',
  pyaterochka: 'https://5ka.ru/',
  magnit: 'https://magnit.ru/',
  lenta: 'https://lenta.com/',
};
