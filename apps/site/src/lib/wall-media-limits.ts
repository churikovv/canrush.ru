/** Shared by the wall composer and the server: one record holds up to 5 items, at most one video. */
export type WallMediaKind = 'image' | 'gif' | 'video';
export const MAX_WALL_MEDIA = 5;
export const MAX_WALL_GIF_BYTES = 8 * 1024 * 1024;
export const MAX_WALL_VIDEO_BYTES = 20 * 1024 * 1024;
/** Whole upload stays below the 26 MB request limit of the proxy and server actions. */
export const MAX_WALL_UPLOAD_BYTES = 24 * 1024 * 1024;
export const WALL_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const WALL_GIF_TYPES = ['image/gif'];
export const WALL_VIDEO_TYPES = ['video/mp4', 'video/webm'];
export const WALL_MEDIA_ACCEPT = [...WALL_IMAGE_TYPES, ...WALL_GIF_TYPES, ...WALL_VIDEO_TYPES].join(',');
