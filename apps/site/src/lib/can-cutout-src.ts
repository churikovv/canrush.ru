/**
 * The address of a cover without its shop background (`/api/can-cutouts`), for Bankomat cards. Only our own covers start
 * with `/`; another site's address stays as it is, and its card keeps the light panel (`null`).
 */
export const cutoutSrc = (cover: string): string | null => (cover.startsWith('/') ? `/api/can-cutouts?src=${encodeURIComponent(cover)}` : null);
