import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { parseRange } from '@/lib/byte-range';
import { prepareWallMedia, sniffVideo } from '@/lib/wall-media';
import { sortReviews } from '@/components/review-sorter';

const mp4 = () => Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom'), Buffer.alloc(64)]);
const webm = () => Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(64)]);
async function animatedGif() {
  const frame = (r: number) => sharp({ create: { width: 40, height: 30, channels: 3, background: { r, g: 0, b: 0 } } }).png().toBuffer();
  return sharp([await frame(255), await frame(0)], { join: { animated: true } }).gif().toBuffer();
}
const file = (bytes: Buffer, name: string, type: string) => new File([new Uint8Array(bytes)], name, { type });

describe('wall media', () => {
  it('recognizes MP4 and WebM by their container, not by name, and rejects QuickTime', () => {
    expect(sniffVideo(mp4())).toBe('video/mp4');
    expect(sniffVideo(webm())).toBe('video/webm');
    const mov = mp4(); mov.write('qt  ', 8, 'latin1');
    expect(sniffVideo(mov)).toBeNull();
    expect(sniffVideo(Buffer.from('not a video at all'))).toBeNull();
  });
  it('keeps GIF animation as WebP, re-encodes photos and needs a poster for a video', async () => {
    const photo = await sharp({ create: { width: 50, height: 40, channels: 3, background: '#fff' } }).jpeg().toBuffer();
    const poster = await sharp({ create: { width: 64, height: 36, channels: 3, background: '#000' } }).webp().toBuffer();
    const form = new FormData();
    form.append('photos', file(photo, 'a.jpg', 'image/jpeg'));
    form.append('photos', file(await animatedGif(), 'b.gif', 'image/gif'));
    form.append('photos', file(mp4(), 'c.mp4', 'video/mp4'));
    form.append('videoPoster', file(poster, 'poster.webp', 'image/webp'));
    const media = await prepareWallMedia(form);
    expect(media.map(item => [item.kind, item.mime])).toEqual([['image', 'image/webp'], ['gif', 'image/webp'], ['video', 'video/mp4']]);
    expect((await sharp(media[1]!.data, { animated: true }).metadata()).pages).toBe(2);
    const missingPoster = new FormData();
    missingPoster.append('photos', file(webm(), 'clip.webm', 'video/webm'));
    await expect(prepareWallMedia(missingPoster)).rejects.toThrow('превью');
    const twoVideos = new FormData();
    for (const name of ['1.mp4', '2.mp4']) twoVideos.append('photos', file(mp4(), name, 'video/mp4'));
    twoVideos.append('videoPoster', file(poster, 'poster.webp', 'image/webp'));
    await expect(prepareWallMedia(twoVideos)).rejects.toThrow('одно видео');
    const disguised = new FormData();
    disguised.append('photos', file(Buffer.from('<script>alert(1)</script>'), 'x.mp4', 'video/mp4'));
    await expect(prepareWallMedia(disguised)).rejects.toThrow('Не удалось прочитать');
  });
});

describe('byte ranges', () => {
  it('serves bounded single ranges and rejects unsatisfiable ones', () => {
    expect(parseRange(null, 100)).toBeNull();
    expect(parseRange('bytes=0-', 100)).toEqual({ start: 0, end: 99 });
    expect(parseRange('bytes=10-19', 100)).toEqual({ start: 10, end: 19 });
    expect(parseRange('bytes=-10', 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange('bytes=0-', 10 * 1024 * 1024)).toEqual({ start: 0, end: 2 * 1024 * 1024 - 1 });
    for (const header of ['bytes=100-', 'bytes=5-2', 'bytes=-', 'items=0-1', 'bytes=0-1,4-5']) expect(parseRange(header, 100)).toBe('invalid');
  });
});

describe('review order', () => {
  it('sorts by date either way and by likes with newer reviews first on ties', () => {
    const items = [
      { id: 'a', createdAt: '2026-10-01T00:00:00Z', likes: 2 },
      { id: 'b', createdAt: '2026-10-03T00:00:00Z', likes: 0 },
      { id: 'c', createdAt: '2026-10-02T00:00:00Z', likes: 2 },
    ];
    expect(sortReviews(items, 'new').map(item => item.id)).toEqual(['b', 'c', 'a']);
    expect(sortReviews(items, 'old').map(item => item.id)).toEqual(['a', 'c', 'b']);
    expect(sortReviews(items, 'liked').map(item => item.id)).toEqual(['c', 'a', 'b']);
  });
});
