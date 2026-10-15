import sharp, { type Metadata } from 'sharp';
import { encodeStillPhoto, ReviewPhotoError } from '@/lib/review-photos';
import { MAX_REVIEW_PHOTO_BYTES } from '@/lib/review-photo-limits';
import { MAX_WALL_GIF_BYTES, MAX_WALL_MEDIA, MAX_WALL_UPLOAD_BYTES, MAX_WALL_VIDEO_BYTES, type WallMediaKind } from '@/lib/wall-media-limits';

export interface PreparedWallMedia { kind: WallMediaKind; mime: 'image/webp' | 'video/mp4' | 'video/webm'; data: Buffer; thumbnail: Buffer }

/** Container signature, not the browser-supplied MIME type: ISO BMFF (`ftyp`) or Matroska/WebM (EBML). */
export function sniffVideo(bytes: Buffer): 'video/mp4' | 'video/webm' | null {
  if (bytes.length >= 12 && bytes.toString('latin1', 4, 8) === 'ftyp') {
    const brand = bytes.toString('latin1', 8, 12);
    // QuickTime (`qt  `) often carries HEVC that most browsers cannot play.
    return brand === 'qt  ' ? null : 'video/mp4';
  }
  return bytes.length >= 4 && bytes.readUInt32BE(0) === 0x1a45dfa3 ? 'video/webm' : null;
}

/** Animated GIF/WebP becomes an animated WebP (max 720 px) with a small animated thumbnail. */
async function encodeAnimation(bytes: Buffer): Promise<PreparedWallMedia> {
  const options = { animated: true, limitInputPixels: 40_000_000, failOn: 'warning' } as const;
  const metadata = await sharp(bytes, options).metadata();
  if ((metadata.pages ?? 1) > 300) throw new ReviewPhotoError('В GIF слишком много кадров. Выберите анимацию короче.');
  const data = await sharp(bytes, options).resize({ width: 720, height: 720, fit: 'inside', withoutEnlargement: true }).webp({ quality: 75, effort: 4 }).toBuffer();
  const thumbnail = await sharp(data, { animated: true }).resize({ width: 320, height: 320, fit: 'inside', withoutEnlargement: true }).webp({ quality: 65 }).toBuffer();
  if (data.length > MAX_WALL_GIF_BYTES || thumbnail.length > 2 * 1024 * 1024) throw new ReviewPhotoError('GIF получился слишком большим. Выберите анимацию короче или меньше.');
  return { kind: 'gif', mime: 'image/webp', data, thumbnail };
}

/**
 * Validates and re-encodes wall attachments from form fields `photos` (in order) and `videoPoster`
 * (a frame captured by the browser, required with a video and re-encoded here as its thumbnail).
 */
export async function prepareWallMedia(form: FormData): Promise<PreparedWallMedia[]> {
  const entries = form.getAll('photos');
  const posters = form.getAll('videoPoster');
  if ([...entries, ...posters].some(entry => typeof entry === 'string')) throw new ReviewPhotoError('Некорректные вложения.');
  const files = (entries as File[]).filter(file => file.size > 0);
  if (files.length > MAX_WALL_MEDIA) throw new ReviewPhotoError('Можно добавить не более 5 вложений.');
  if (files.reduce((sum, file) => sum + file.size, 0) > MAX_WALL_UPLOAD_BYTES) throw new ReviewPhotoError('Вложения вместе должны быть не больше 24 МБ.');
  const media: PreparedWallMedia[] = [];
  // Sequential decoding bounds peak memory.
  for (const file of files) {
    if (file.size > MAX_WALL_VIDEO_BYTES) throw new ReviewPhotoError('Видео должно быть не больше 20 МБ.');
    const bytes = Buffer.from(await file.arrayBuffer());
    const video = sniffVideo(bytes);
    if (video) {
      if (media.some(item => item.kind === 'video')) throw new ReviewPhotoError('К записи можно прикрепить одно видео.');
      const poster = posters[0] as File | undefined;
      if (!poster || posters.length !== 1 || poster.size > MAX_REVIEW_PHOTO_BYTES) throw new ReviewPhotoError('Не удалось подготовить превью видео. Используйте MP4 (H.264) или WebM.');
      try {
        const { thumbnail } = await encodeStillPhoto(Buffer.from(await poster.arrayBuffer()));
        media.push({ kind: 'video', mime: video, data: bytes, thumbnail });
      } catch { throw new ReviewPhotoError('Не удалось подготовить превью видео. Используйте MP4 (H.264) или WebM.'); }
      continue;
    }
    let metadata: Metadata;
    try { metadata = await sharp(bytes, { limitInputPixels: 40_000_000, failOn: 'warning' }).metadata(); }
    catch { throw new ReviewPhotoError('Не удалось прочитать вложение. Поддерживаются JPG, PNG, WebP, GIF, MP4 и WebM.'); }
    if (metadata.format === 'gif' || (metadata.format === 'webp' && (metadata.pages ?? 1) > 1)) {
      if (file.size > MAX_WALL_GIF_BYTES) throw new ReviewPhotoError('GIF должен быть не больше 8 МБ.');
      try { media.push(await encodeAnimation(bytes)); }
      catch (error) { throw error instanceof ReviewPhotoError ? error : new ReviewPhotoError('Не удалось прочитать GIF.'); }
      continue;
    }
    if (file.size > MAX_REVIEW_PHOTO_BYTES) throw new ReviewPhotoError('Каждая фотография должна быть не больше 5 МБ.');
    try { media.push({ kind: 'image', mime: 'image/webp', ...await encodeStillPhoto(bytes) }); }
    catch { throw new ReviewPhotoError('Не удалось прочитать фотографию. Используйте обычное изображение JPG, PNG или WebP до 40 мегапикселей.'); }
  }
  if (posters.length && !media.some(item => item.kind === 'video')) throw new ReviewPhotoError('Некорректные вложения.');
  return media;
}
