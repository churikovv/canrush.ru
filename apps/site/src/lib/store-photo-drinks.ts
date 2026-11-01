import sharp from 'sharp';
import { getGigaChatMax, type GigaChatClient } from '@/lib/gigachat';
import { storeDrinkOptions, type StoreDrinkOption } from '@/lib/store-catalog';
import { SEEN_DRINKS_PROMPT, STORE_SCAN_PHOTOS, matchDrinksPrompt, parseMatches, parseSeenDrinks, splitSeenDrinks } from '@/lib/store-photo-fields';

/** `others` — нет в каталоге, `unread` — бренды, у которых вкус на фото не прочитан: их участник выбирает сам. */
export interface ScannedDrinks { drinks: StoreDrinkOption[]; others: string[]; unread: string[] }

/** Хватает, чтобы читать этикетки: нейросеть всё равно платит токенами за размер, а не за исходник. */
const toJpeg = (photo: Buffer) => sharp(photo).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();

/**
 * Два вопроса: что видно на фото и какие это напитки каталога. Второй задаётся без фото и только про увиденные банки: так модель не
 * отмечает весь список подряд, а в магазин попадает только то, что есть в каталоге. Файл у нейросети удаляется сразу после первого.
 */
async function scanPhoto(model: GigaChatClient, photo: Buffer, options: readonly StoreDrinkOption[]): Promise<ScannedDrinks> {
  const file = await model.uploadImage(await toJpeg(photo));
  let reply: string;
  try {
    reply = await model.chat([{ role: 'user', content: SEEN_DRINKS_PROMPT, attachments: [file] }], { maxTokens: 600, temperature: 0.1 });
  } finally {
    await model.deleteFile(file).catch(() => undefined);
  }
  const { cans, options: candidates, others, unread } = splitSeenDrinks(parseSeenDrinks(reply), options);
  if (!cans.length) return { drinks: [], others, unread };
  const answer = await model.chat([{ role: 'user', content: matchDrinksPrompt(cans, candidates) }], { maxTokens: 400, temperature: 0.1 });
  const matches = parseMatches(answer, cans.length, candidates.length);
  return {
    drinks: [...new Set(matches.values())].flatMap(number => candidates[number - 1] ?? []),
    others: [...others, ...cans.flatMap((can, index) => (matches.has(index + 1) ? [] : [`${can.brand} ${can.flavor}`]))],
    unread,
  };
}

/** Напитки с фото магазина. `null` — нейросеть не подключена. Участник всегда видит список и может всё поправить. */
export async function scanStorePhotos(photos: readonly Buffer[], model = getGigaChatMax()): Promise<ScannedDrinks | null> {
  if (!model) return null;
  const options = await storeDrinkOptions();
  const found = new Map<string, StoreDrinkOption>();
  const others = new Set<string>();
  const unread = new Set<string>();
  for (const photo of photos.slice(0, STORE_SCAN_PHOTOS)) {
    const result = await scanPhoto(model, photo, options);
    for (const drink of result.drinks) found.set(JSON.stringify([drink.brand, drink.flavor]), drink);
    for (const name of result.others) others.add(name);
    for (const name of result.unread) unread.add(name);
  }
  return { drinks: [...found.values()], others: [...others], unread: [...unread] };
}
