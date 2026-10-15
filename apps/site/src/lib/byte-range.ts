/** Larger slices are served in parts; players ask for the rest themselves. */
const MAX_RANGE_BYTES = 2 * 1024 * 1024;

/** Parses a single `bytes=` range; multipart ranges are not supported (players never need them). */
export function parseRange(header: string | null, size: number): { start: number; end: number } | 'invalid' | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (!match[1] && !match[2])) return 'invalid';
  let start: number; let end: number;
  if (!match[1]) { start = Math.max(0, size - Number(match[2])); end = size - 1; }
  else { start = Number(match[1]); end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1; }
  if (!Number.isSafeInteger(start) || start >= size || end < start) return 'invalid';
  return { start, end: Math.min(end, start + MAX_RANGE_BYTES - 1) };
}
