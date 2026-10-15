import sharp from 'sharp';
import { MAX_REVIEW_PHOTOS, MAX_REVIEW_PHOTO_BYTES, PHOTO_ID_PATTERN, REVIEW_PHOTO_TYPES } from './review-photo-limits';

export class ReviewPhotoError extends Error {}
export interface PreparedReviewPhoto { data: Buffer; thumbnail: Buffer }

/** Re-encodes one still JPEG/PNG/WebP (never an animation) to a bounded WebP and its thumbnail. */
export async function encodeStillPhoto(bytes: Buffer): Promise<PreparedReviewPhoto> {
  const metadata = await sharp(bytes, { limitInputPixels: 40_000_000, failOn: 'warning' }).metadata();
  if (!['jpeg', 'png', 'webp'].includes(metadata.format ?? '') || (metadata.pages ?? 1) > 1) throw new Error('Unsupported image');
  const data = await sharp(bytes, { limitInputPixels: 40_000_000, failOn: 'warning' })
    .rotate().resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  const thumbnail = await sharp(data).resize({ width: 320, height: 320, fit: 'inside', withoutEnlargement: true }).webp({ quality: 75 }).toBuffer();
  if (data.length > 2 * 1024 * 1024 || thumbnail.length > 256 * 1024) throw new Error('Output too large');
  return { data, thumbnail };
}

export async function prepareReviewPhotos(formData: FormData) {
  const retained = formData.getAll('retainedPhoto');
  const entries = formData.getAll('photos');
  if (retained.some(id => typeof id !== 'string' || !PHOTO_ID_PATTERN.test(id)) || new Set(retained).size !== retained.length) {
    throw new ReviewPhotoError('Не удалось проверить сохранённые фотографии. Обновите страницу.');
  }
  if (entries.some(entry => typeof entry === 'string')) throw new ReviewPhotoError('Некорректные фотографии.');
  const files = (entries as File[]).filter(file => file.size > 0);
  if (files.length + retained.length > MAX_REVIEW_PHOTOS) throw new ReviewPhotoError('Можно добавить не более 5 фотографий.');
  if (files.some(file => file.size > MAX_REVIEW_PHOTO_BYTES)) throw new ReviewPhotoError('Каждая фотография должна быть не больше 5 МБ.');
  if (files.some(file => !REVIEW_PHOTO_TYPES.includes(file.type))) throw new ReviewPhotoError('Выберите фотографии в формате JPG, PNG или WebP.');
  const photos: PreparedReviewPhoto[] = [];
  // Decode sequentially to bound peak memory; do not trust MIME or filenames.
  for (const file of files) {
    try {
      photos.push(await encodeStillPhoto(Buffer.from(await file.arrayBuffer())));
    } catch {
      throw new ReviewPhotoError('Не удалось прочитать фотографию. Используйте обычное изображение JPG, PNG или WebP до 40 мегапикселей.');
    }
  }
  return { retained: retained as string[], photos };
}
