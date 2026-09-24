import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { prepareReviewPhotos } from '../src/lib/review-photos';

function form(bytes: Uint8Array, type = 'image/png') {
  const data = new FormData();
  data.append('photos', new File([new Uint8Array(bytes)], 'photo.png', { type }));
  return data;
}

describe('review photo processing', () => {
  it('reencodes, resizes, orients and strips metadata; makes a separate thumbnail', async () => {
    const input = await sharp({ create: { width: 3000, height: 1000, channels: 3, background: '#006eff' } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const result = await prepareReviewPhotos(form(input, 'image/jpeg'));
    const output = await sharp(result.photos[0]!.data).metadata();
    const thumb = await sharp(result.photos[0]!.thumbnail).metadata();
    expect(output.format).toBe('webp');
    expect(output.height).toBe(2048);
    expect(output.width).toBeLessThan(2048);
    expect(output.exif).toBeUndefined();
    expect(output.orientation).toBeUndefined();
    expect(thumb.height).toBe(320);
  });
  it('rejects SVG or corrupt content disguised as a photo', async () => {
    for (const body of ['<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"></svg>', 'not a photo']) {
      await expect(prepareReviewPhotos(form(new TextEncoder().encode(body)))).rejects.toThrow('Не удалось прочитать');
    }
  });
  it('rejects too many images, oversize files, and invalid retained ids', async () => {
    const tooMany = new FormData();
    for (let i = 0; i < 6; i++) tooMany.append('photos', new File(['x'], 'x.jpg', { type: 'image/jpeg' }));
    await expect(prepareReviewPhotos(tooMany)).rejects.toThrow('не более 5');
    await expect(prepareReviewPhotos(form(new Uint8Array(5 * 1024 * 1024 + 1)))).rejects.toThrow('не больше 5 МБ');
    const invalid = new FormData(); invalid.append('retainedPhoto', '../another-file');
    await expect(prepareReviewPhotos(invalid)).rejects.toThrow('проверить');
  });
  it('accepts a text-only review without attachments', async () => {
    expect(await prepareReviewPhotos(new FormData())).toEqual({ retained: [], photos: [] });
  });
});
