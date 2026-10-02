import { load } from 'cheerio';

export interface IngredientSource {
  id: string;
  name: string;
  host: string;
  market: 'RU' | 'BY';
  strategy: 'http' | 'tavily';
  paths: string[];
  priority: number;
  evidence: string;
  notes: string;
  examples: string[];
}

export function sourceForUrl(value: string, sources: IngredientSource[]): IngredientSource | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return undefined;
    return sources.find((source) => url.hostname.replace(/^www\./, '') === source.host.replace(/^www\./, '') && source.paths.some((prefix) => url.pathname.startsWith(prefix)));
  } catch { return undefined; }
}

export function htmlDocument(html: string): { title: string; text: string } {
  const $ = load(html);
  const title = $('h1').first().text().trim() || $('title').text().trim();
  $('script, style, noscript, header, footer, nav').remove();
  $('br').replaceWith('\n');
  $('p, div, section, article, h1, h2, h3, h4, li, tr, dt, dd').each((_, element) => {
    $(element).prepend('\n').append('\n');
  });
  return { title, text: $('body').text().replace(/\r/g, '').replace(/[\t\u00a0 ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim() };
}

/** Extract only explicitly labelled ingredients, never infer them from advertising. */
export function extractIngredients(text: string, productTitle = ''): { ingredients: string | null; warnings: string[] } {
  const normalized = text.replace(/\r/g, '').replace(/\u00a0/g, ' ');
  const start = /(?:^|\n|[.!?] +)[ \t#*]*Состав[ \t*]*(?::|\n|\|)/iu.exec(normalized);
  if (!start) return { ingredients: null, warnings: ['no_explicit_ingredients'] };
  const tail = normalized.slice(start.index + start[0].length).replace(/^[\s*|]+/, '');
  const stop = /\n\s*(?:#{1,6}\s*)?(?:Характеристики|На 100|Пищевая ценность|Энергетическая ценность|Условия хранения|Срок (?:годности|хранения)|Бренд|Изготовитель|Производитель|Описание|Отзывы|Рекомендуем|Похожие|Тип пива|О товаре|Витамины на|Объем|Объём|Состав|\|?\s*Количество предметов)(?:\s|:|$)/iu;
  const section = tail.split(stop)[0]?.trim() ?? '';
  // A table cell or a paragraph is the boundary: don't ingest footer/recommendation text.
  const ingredients = section.split(/\n\s*\n|\s\|/)[0]?.replace(/\s+/g, ' ').trim() ?? '';
  if (ingredients.length < 35 || !/вода|сахар|таурин|кофеин/iu.test(ingredients)) {
    return { ingredients: null, warnings: ['empty_or_unusable_ingredients'] };
  }
  if (ingredients.length > 2500) return { ingredients: null, warnings: ['unclear_section_boundary'] };
  const warnings = ['verify_exact_product_and_label'];
  if (/…|\.\.\.|,$/.test(ingredients)) warnings.push('possibly_truncated');
  if (/(?:без\s+сахара|sugar[\s-]*free|zero\s+sugar)/iu.test(productTitle)
    && /(?:^|[,;]\s*)(?:сахар|сахароза|глюкоза|фруктоза)(?:[,;\s]|$)/iu.test(ingredients)) warnings.push('possible_sugar_conflict');
  if (/витамин/iu.test(ingredients) && /\d/.test(ingredients)) warnings.push('verify_nutrient_numbers');
  return { ingredients, warnings };
}
