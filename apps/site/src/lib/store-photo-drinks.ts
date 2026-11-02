import sharp from 'sharp';
import { getGptApi, type AskOptions } from '@/lib/gpt-api';
import { storeDrinkOptions, type StoreDrinkOption } from '@/lib/store-catalog';
import { SEEN_DRINKS_PROMPT, STORE_SCAN_PHOTOS, isBareLine, matchDrinksPrompt, mergeSeenDrinks, parseMatches, parseOtherNames, parseSeenDrinks, splitSeenDrinks, uniqueNames } from '@/lib/store-photo-fields';

/** `others` — нет в каталоге, `unread` — бренды, у которых вкус на фото не прочитан: их участник выбирает сам. */
export interface ScannedDrinks { drinks: StoreDrinkOption[]; others: string[]; unread: string[] }
/** Нейросеть, которой можно задать вопрос, в том числе про фото. */
export interface PhotoModel { ask(prompt: string, options?: AskOptions): Promise<string> }

/**
 * Фото разбираются одновременно: обычно 30–60 секунд, загруженная полка у модели бывает и дольше минуты. Что не успело к сроку,
 * обрывается, и опоздавшее фото просто не даёт напитков: участник к этому времени уже заполняет список сам.
 */
const SCAN_DEADLINE_MS = 150_000;
/**
 * Быстрый режим то читает полку целиком, то останавливается на паре банок. Два чтения одновременно и их объединение почти не
 * добавляют времени и стоят копейки.
 */
const SHELF_READS = 2;
/** Сколько сервер помнит готовый разбор, пока форма его не забрала. */
export const SCAN_KEPT_MS = 10 * 60_000;

/** Хватает, чтобы читать этикетки: нейросеть всё равно платит токенами за размер, а не за исходник. */
const toJpeg = (photo: Buffer) => sharp(photo).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();

/**
 * Два вопроса: что видно на фото и какие это напитки каталога. Второй задаётся без фото и только про увиденные банки: так модель не
 * отмечает весь список подряд, а в магазин попадает только то, что есть в каталоге.
 */
async function scanPhoto(model: PhotoModel, photo: Buffer, options: readonly StoreDrinkOption[], signal: AbortSignal): Promise<ScannedDrinks> {
  const image = await toJpeg(photo);
  const reads = await Promise.allSettled(Array.from({ length: SHELF_READS }, () => model.ask(SEEN_DRINKS_PROMPT, { image, maxTokens: 4000, signal })));
  const replies = reads.flatMap(read => (read.status === 'fulfilled' ? [parseSeenDrinks(read.value)] : []));
  const failure = reads.find(read => read.status === 'rejected');
  if (!replies.length && failure) throw failure.reason;
  const { cans, options: candidates, others, unread } = splitSeenDrinks(mergeSeenDrinks(replies), options);
  if (!cans.length) return { drinks: [], others, unread };
  const answer = await model.ask(matchDrinksPrompt(cans, candidates), { maxTokens: 2000, signal });
  const matches = parseMatches(answer, cans.length, candidates.length);
  const names = parseOtherNames(answer, cans.length);
  return {
    drinks: [...new Set(matches.values())].flatMap(number => candidates[number - 1] ?? []),
    others: [...others, ...cans.flatMap((can, index) => (matches.has(index + 1) || isBareLine(can.flavor) ? [] : [names.get(index + 1) ?? `${can.brand} ${can.flavor}`]))],
    unread,
  };
}

/**
 * Напитки с фото магазина. `null` — нейросеть не подключена. Участник всегда видит список и может всё поправить. Сбой одного фото не
 * мешает остальным; ошибка — когда упавшее фото не перекрыто найденным на других.
 */
export async function scanStorePhotos(photos: readonly Buffer[], model: PhotoModel | null = getGptApi()): Promise<ScannedDrinks | null> {
  if (!model) return null;
  const options = await storeDrinkOptions();
  const signal = AbortSignal.timeout(SCAN_DEADLINE_MS);
  const results = await Promise.allSettled(photos.slice(0, STORE_SCAN_PHOTOS).map(photo => scanPhoto(model, photo, options, signal)));
  const scanned = results.flatMap(result => (result.status === 'fulfilled' ? [result.value] : []));
  const failure = results.find(result => result.status === 'rejected');
  // Фасад магазина без банок рядом с упавшей полкой — не «знакомых банок нет», а сбой: участник добавит напитки сам.
  if (failure && !scanned.some(result => result.drinks.length || result.others.length || result.unread.length)) throw failure.reason;
  const found = new Map<string, StoreDrinkOption>();
  for (const drink of scanned.flatMap(result => result.drinks)) found.set(JSON.stringify([drink.brand, drink.flavor]), drink);
  const drinks = [...found.values()];
  // «Вкус не разобрали: Monster» рядом с двадцатью найденными Monster только путает: этот бренд участник уже видит в списке.
  const unread = [...new Set(scanned.flatMap(result => result.unread))].filter(brand => !drinks.some(drink => drink.brand === brand));
  return { drinks, others: uniqueNames(scanned.flatMap(result => result.others)), unread };
}
