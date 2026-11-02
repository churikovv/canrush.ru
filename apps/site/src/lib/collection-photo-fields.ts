/** Rules of «Фото коллекции» shared by the browser and the server. */
export const MAX_COLLECTION_PHOTOS = 12;
/** Photos sent in one go: each is re-encoded on the server, so a batch stays small. */
export const MAX_COLLECTION_UPLOAD = 5;
export const MAX_COLLECTION_CAPTION = 80;

export class CollectionPhotoError extends Error {}

/** A caption is one short line; empty means none. */
export function parseCollectionCaption(value: unknown): string | null {
  if (value !== undefined && value !== null && typeof value !== 'string') throw new CollectionPhotoError('Некорректная подпись.');
  const caption = (value ?? '').replace(/\s+/gu, ' ').trim();
  if (caption.length > MAX_COLLECTION_CAPTION) throw new CollectionPhotoError(`Подпись — до ${MAX_COLLECTION_CAPTION} символов.`);
  return caption || null;
}

/** How many more photos fit next to the ones already there. */
export const collectionRoom = (count: number) => Math.max(0, MAX_COLLECTION_PHOTOS - count);
