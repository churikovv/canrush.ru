/**
 * Articles of the «Новости» section: a Notion-like document of blocks. Shared by the editor (browser) and the server,
 * which re-checks everything: block types, sizes and the inline markup, which is a small whitelist (bold, italic,
 * strike, code, links, line breaks) re-written tag by tag, so stored text is always safe to render as HTML.
 */

export const ARTICLE_TITLE_MAX = 120;
export const ARTICLE_BLOCKS_MAX = 300;
export const ARTICLE_BLOCK_TEXT_MAX = 4000;
export const ARTICLE_CAPTION_MAX = 200;
export const ARTICLE_IMAGES_MAX = 30;
/** Text a submitted article needs, besides the title: more than a single word. */
export const ARTICLE_MIN_TEXT = 50;
/** Articles of one author waiting for review at once, and a pause between submissions. */
export const MAX_PENDING_ARTICLES = 5;
export const ARTICLE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const TEXT_BLOCKS = ['paragraph', 'heading1', 'heading2', 'heading3', 'bulleted', 'numbered', 'todo', 'quote', 'callout'] as const;
export const OBJECT_BLOCKS = ['divider', 'image', 'drink'] as const;
export type TextBlockType = typeof TEXT_BLOCKS[number];
export type ObjectBlockType = typeof OBJECT_BLOCKS[number];
export type ArticleBlockType = TextBlockType | ObjectBlockType;

export type ArticleBlock =
  | { id: string; type: TextBlockType; text: string; checked?: boolean }
  | { id: string; type: 'divider' }
  | { id: string; type: 'image'; imageId: string; caption: string }
  | { id: string; type: 'drink'; brand: string; flavor: string };

export type ArticleStatus = 'draft' | 'pending' | 'published' | 'rejected';
export const ARTICLE_STATUS_LABELS: Record<ArticleStatus, string> = { draft: 'Черновик', pending: 'На проверке', published: 'Опубликована', rejected: 'Отклонена' };

/** The «/» menu and the block menu: what each block is called, a hint and the markdown that turns text into it. */
export const BLOCK_MENU: { type: ArticleBlockType; label: string; hint: string; keywords: string; markdown?: string }[] = [
  { type: 'paragraph', label: 'Текст', hint: 'Обычный абзац', keywords: 'text paragraph текст абзац' },
  { type: 'heading1', label: 'Заголовок 1', hint: 'Крупный раздел', keywords: 'h1 heading заголовок', markdown: '#' },
  { type: 'heading2', label: 'Заголовок 2', hint: 'Подраздел', keywords: 'h2 heading заголовок', markdown: '##' },
  { type: 'heading3', label: 'Заголовок 3', hint: 'Небольшой заголовок', keywords: 'h3 heading заголовок', markdown: '###' },
  { type: 'bulleted', label: 'Список', hint: 'Маркированный список', keywords: 'list bullet список маркер', markdown: '-' },
  { type: 'numbered', label: 'Нумерованный список', hint: '1, 2, 3', keywords: 'list numbered список номер', markdown: '1.' },
  { type: 'todo', label: 'Чек-лист', hint: 'Пункты с галочкой', keywords: 'todo check чеклист задача галочка', markdown: '[]' },
  { type: 'quote', label: 'Цитата', hint: 'Выделенная цитата', keywords: 'quote цитата', markdown: '>' },
  { type: 'callout', label: 'Выноска', hint: 'Важная заметка с иконкой', keywords: 'callout note выноска заметка важно' },
  { type: 'divider', label: 'Разделитель', hint: 'Горизонтальная линия', keywords: 'divider line разделитель линия', markdown: '---' },
  { type: 'image', label: 'Фото', hint: 'Загрузить изображение', keywords: 'image photo фото картинка изображение' },
  { type: 'drink', label: 'Напиток', hint: 'Карточка из каталога', keywords: 'drink catalog напиток энергетик каталог' },
];

export const isTextBlock = (type: string): type is TextBlockType => (TEXT_BLOCKS as readonly string[]).includes(type);
const isBlockType = (type: unknown): type is ArticleBlockType => typeof type === 'string' && (isTextBlock(type) || (OBJECT_BLOCKS as readonly string[]).includes(type));

export const newBlockId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

const ENTITY = /&(?:(amp|lt|gt|quot|nbsp|#39|#x27|#\d{1,6}|#x[0-9a-f]{1,6});)?/gi;
const escapeText = (text: string) => text.replace(ENTITY, (match, name: string | undefined) => name ? match : '&amp;').replace(/"/g, '&quot;');
const escapeAttribute = (text: string) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const decodeEntities = (text: string) => text.replace(/&nbsp;/gi, ' ').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;|&#x27;/gi, "'")
  .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, code: string) => { const point = code[0] === 'x' || code[0] === 'X' ? parseInt(code.slice(1), 16) : Number(code); return point > 0 && point < 0x110000 ? String.fromCodePoint(point) : ''; })
  .replace(/&amp;/gi, '&');

const TAG_ALIASES: Record<string, 'b' | 'i' | 's' | 'code' | 'a'> = { b: 'b', strong: 'b', i: 'i', em: 'i', s: 's', strike: 's', del: 's', code: 'code', a: 'a' };

/**
 * Text colours of the editor: secondary (muted) text and two accents. The editor paints with execCommand('foreColor'),
 * which writes <font color>; the stored form is <span data-color>, which the page colours by theme.
 */
export const TEXT_COLORS = { muted: { label: 'Вторичный', hex: '#8a8f98' }, brand: { label: 'Синий', hex: '#006eff' }, red: { label: 'Красный', hex: '#e5484d' } } as const;
export type TextColor = keyof typeof TEXT_COLORS;
function colorName(attributes: string): TextColor | null {
  const named = /data-color\s*=\s*["']?([a-z]+)/i.exec(attributes)?.[1];
  if (named && Object.hasOwn(TEXT_COLORS, named)) return named as TextColor;
  const value = (/\bcolor\s*=\s*["']?([^"'\s>]+)/i.exec(attributes)?.[1] ?? '').toLowerCase();
  const rgb = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(value);
  const hex = rgb ? `#${rgb.slice(1).map(part => Number(part).toString(16).padStart(2, '0')).join('')}` : value;
  return (Object.keys(TEXT_COLORS) as TextColor[]).find(key => TEXT_COLORS[key].hex === hex) ?? null;
}

/** A link the article may carry: http(s) anywhere, or a path on this site. */
export function safeHref(raw: string): string | null {
  const href = decodeEntities(raw.trim());
  if (/^\/(?!\/)[^\s"'<>\\]*$/.test(href)) return href;
  if (/^https?:\/\/[^\s"'<>\\]+$/i.test(href)) return href.slice(0, 500);
  return null;
}

/**
 * Re-writes inline HTML from a contenteditable to the whitelist: every allowed tag is rebuilt without attributes (a link
 * keeps only a checked href), every other tag is dropped with its text kept, tags are balanced, and text is escaped.
 */
export function sanitizeInline(html: string): string {
  let out = '';
  const open: string[] = [];
  for (const part of html.replace(/<!--[\s\S]*?-->/g, '').split(/(<[^>]*>)/)) {
    if (!part) continue;
    if (!part.startsWith('<')) { out += escapeText(part.replace(/[<>]/g, '')); continue; }
    const match = /^<\s*(\/)?\s*([a-z0-9]+)([^>]*)>$/i.exec(part);
    if (!match) continue;
    const [, closing, rawName, attributes = ''] = match;
    const name = rawName!.toLowerCase();
    if (name === 'br') { out += '<br>'; continue; }
    // A colour span: kept only with a known colour; an unknown one keeps its text and closes without a tag ('#').
    if (name === 'font' || name === 'span') {
      if (closing) {
        const at = Math.max(open.lastIndexOf('span'), open.lastIndexOf('#'));
        if (at < 0) continue;
        while (open.length > at) { const tag = open.pop()!; if (tag !== '#') out += `</${tag}>`; }
        continue;
      }
      const color = colorName(attributes);
      if (color && !open.includes('span')) { out += `<span data-color="${color}">`; open.push('span'); } else open.push('#');
      continue;
    }
    // Chrome wraps lines of a contenteditable in <div>s: each new one starts a new line.
    if (name === 'div' || name === 'p') { if (!closing && out && !out.endsWith('<br>')) out += '<br>'; continue; }
    const tag = TAG_ALIASES[name];
    if (!tag) continue;
    if (closing) {
      const at = open.lastIndexOf(tag);
      if (at < 0) continue;
      while (open.length > at) { const tag = open.pop()!; if (tag !== '#') out += `</${tag}>`; }
      continue;
    }
    if (tag === 'a') {
      if (open.includes('a')) continue;
      const href = /href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attributes);
      const safe = href ? safeHref(href[2] ?? href[3] ?? href[4] ?? '') : null;
      if (!safe) continue;
      out += `<a href="${escapeAttribute(safe)}">`;
    } else out += `<${tag}>`;
    open.push(tag);
  }
  while (open.length) { const tag = open.pop()!; if (tag !== '#') out += `</${tag}>`; }
  return out.replace(/(<br>)+$/, '');
}

/** The visible text of inline HTML: for limits, summaries and search. */
export function inlineText(html: string): string {
  return decodeEntities(html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, ''));
}

export class ArticleError extends Error {}

/** Checks a document from the editor: known block types only, sizes within limits, inline text sanitised. */
export function parseArticleBlocks(raw: unknown): ArticleBlock[] {
  if (!Array.isArray(raw)) throw new ArticleError('Не удалось прочитать статью. Обновите страницу.');
  if (raw.length > ARTICLE_BLOCKS_MAX) throw new ArticleError(`В статье может быть до ${ARTICLE_BLOCKS_MAX} блоков.`);
  const ids = new Set<string>();
  const blocks: ArticleBlock[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const value = item as Record<string, unknown>;
    const id = typeof value.id === 'string' && /^[a-z0-9]{4,24}$/.test(value.id) && !ids.has(value.id) ? value.id : newBlockId();
    ids.add(id);
    if (!isBlockType(value.type)) continue;
    if (isTextBlock(value.type)) {
      const text = sanitizeInline(typeof value.text === 'string' ? value.text : '');
      if (inlineText(text).length > ARTICLE_BLOCK_TEXT_MAX) throw new ArticleError(`Один блок может содержать до ${ARTICLE_BLOCK_TEXT_MAX} символов.`);
      blocks.push(value.type === 'todo' ? { id, type: 'todo', text, checked: value.checked === true } : { id, type: value.type, text });
    } else if (value.type === 'divider') blocks.push({ id, type: 'divider' });
    else if (value.type === 'image') {
      if (typeof value.imageId !== 'string' || !ARTICLE_ID_PATTERN.test(value.imageId)) continue;
      const caption = typeof value.caption === 'string' ? value.caption.replace(/\s+/g, ' ').trim().slice(0, ARTICLE_CAPTION_MAX) : '';
      blocks.push({ id, type: 'image', imageId: value.imageId, caption });
    } else {
      const brand = typeof value.brand === 'string' ? value.brand.trim() : '';
      const flavor = typeof value.flavor === 'string' ? value.flavor.trim() : '';
      if (brand && flavor && brand.length <= 60 && flavor.length <= 160) blocks.push({ id, type: 'drink', brand, flavor });
    }
  }
  if (blocks.filter(block => block.type === 'image').length > ARTICLE_IMAGES_MAX) throw new ArticleError(`В статье может быть до ${ARTICLE_IMAGES_MAX} фото.`);
  return blocks;
}

/** The author's Telegram channel attached to the article: a link, @name or bare name; empty — no channel. */
export function parseArticleChannel(raw: unknown): string | null {
  const value = (typeof raw === 'string' ? raw : '').trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '')
    .replace(/^(?:t\.me|telegram\.me)\//i, '').replace(/^@+/, '').replace(/\/$/, '');
  if (!value) return null;
  if (!/^[a-z][a-z0-9_]{4,31}$/i.test(value)) throw new ArticleError('Канал — ссылка t.me или имя канала от 5 до 32 символов.');
  return value;
}

export function parseArticleTitle(raw: unknown): string {
  return (typeof raw === 'string' ? raw : '').replace(/\s+/g, ' ').trim().slice(0, ARTICLE_TITLE_MAX);
}

/** All the text of the document, paragraph by paragraph. */
export function articleText(blocks: readonly ArticleBlock[]): string {
  return blocks.map(block => 'text' in block ? inlineText(block.text) : block.type === 'image' ? block.caption : '').filter(Boolean).join('\n');
}

/** What a submitted article must have; the editor shows the same reasons before sending. */
export function articleReadiness(title: string, blocks: readonly ArticleBlock[]): string | null {
  if (title.trim().length < 3) return 'Добавьте заголовок.';
  if (articleText(blocks).replace(/\s+/g, ' ').trim().length < ARTICLE_MIN_TEXT) return `Напишите хотя бы ${ARTICLE_MIN_TEXT} символов текста.`;
  return null;
}

/** The lead for cards: the first paragraphs, cut on a word. */
export function articleSummary(blocks: readonly ArticleBlock[], max = 180): string {
  const text = blocks.filter(block => block.type === 'paragraph' || block.type === 'quote' || block.type === 'callout')
    .map(block => 'text' in block ? inlineText(block.text) : '').join(' ').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 20)).replace(/[,.;:!?\s—-]+$/, '')}…`;
}

/** Minutes to read, at about 180 words a minute; never less than one. */
export function readingMinutes(blocks: readonly ArticleBlock[]): number {
  const words = articleText(blocks).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 180));
}
