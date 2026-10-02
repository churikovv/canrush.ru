import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { prepareProfileImages } from '../src/lib/profile-images';
const form = (bytes: Uint8Array, name = 'avatar', type = 'image/png') => {
  const data = new FormData(); data.append(name, new File([bytes as Uint8Array<ArrayBuffer>], 'photo.png', { type })); return data;
};
describe('profile image preparation', () => {
  it('crops avatars, bounds banners and strips metadata', async () => {
    const image = await sharp({ create: { width: 900, height: 600, channels: 3, background: '#006eff' } }).withMetadata().png().toBuffer();
    const data = form(image); data.append('banner', new File([image], 'banner.png', { type: 'image/png' }));
    const saved = await prepareProfileImages(data);
    const avatar = await sharp(saved.avatar!).metadata();
    const banner = await sharp(saved.banner!).metadata();
    expect(avatar).toMatchObject({ width: 512, height: 512, format: 'webp' });
    expect(avatar.exif).toBeUndefined(); expect(banner.exif).toBeUndefined();
    expect(banner).toMatchObject({ width: 900, height: 600, format: 'webp' });
  });
  it('uses the selected area and rejects out-of-bounds and malformed crops', async () => {
    const image = await sharp({ create: { width: 800, height: 400, channels: 3, background: 'red' } }).composite([{ input: await sharp({ create: { width: 400, height: 400, channels: 3, background: 'blue' } }).png().toBuffer(), left: 400, top: 0 }]).png().toBuffer();
    const data = form(image); data.set('crop-avatar', JSON.stringify({ left: 400, top: 0, width: 400, height: 400 }));
    const saved = await prepareProfileImages(data);
    const stats = await sharp(saved.avatar!).stats();
    expect(stats.channels[2]!.mean).toBeGreaterThan(240); expect(stats.channels[0]!.mean).toBeLessThan(10);
    for (const crop of [{ left: 401, top: 0, width: 400, height: 400 }, { left: -1, top: 0, width: 400, height: 400 }, { left: 0, top: 0, width: 500, height: 400 }, null]) {
      data.set('crop-avatar', JSON.stringify(crop)); await expect(prepareProfileImages(data)).rejects.toThrow('прочитать');
    }
  });
  it('interprets crop coordinates after EXIF orientation', async () => {
    const image = await sharp({ create: { width: 800, height: 400, channels: 3, background: 'blue' } }).withMetadata({ orientation: 6 }).jpeg().toBuffer();
    const data = form(image, 'avatar', 'image/jpeg'); data.set('crop-avatar', JSON.stringify({ left: 0, top: 400, width: 400, height: 400 }));
    expect((await sharp((await prepareProfileImages(data)).avatar!).metadata()).width).toBe(512);
  });
  it('handles deletion and unchanged fields distinctly', async () => {
    expect(await prepareProfileImages(new FormData())).toEqual({});
    const data = new FormData(); data.set('remove-avatar', 'true');
    expect(await prepareProfileImages(data)).toEqual({ avatar: null });
  });
  it('rejects corrupt, unsupported, oversized, animated and conflicting images', async () => {
    await expect(prepareProfileImages(form(Buffer.from('not an image')))).rejects.toThrow('прочитать');
    await expect(prepareProfileImages(form(Buffer.from('<svg/>'), 'avatar', 'image/svg+xml'))).rejects.toThrow('JPG');
    await expect(prepareProfileImages(form(Buffer.alloc(5 * 1024 * 1024 + 1)))).rejects.toThrow('5 МБ');
    const data = form(Buffer.from('invalid')); data.set('remove-avatar', 'true');
    await expect(prepareProfileImages(data)).rejects.toThrow('замену или удаление');
    const duplicate = form(Buffer.from('invalid')); duplicate.append('avatar', new File(['x'], 'x.png', { type: 'image/png' }));
    await expect(prepareProfileImages(duplicate)).rejects.toThrow('одно изображение');
    const animation = await sharp(Buffer.concat([Buffer.alloc(48, 0), Buffer.alloc(48, 255)]), { raw: { width: 4, height: 8, channels: 3, pageHeight: 4 } }).webp({ loop: 0, delay: [100, 100] }).toBuffer();
    expect((await sharp(animation).metadata()).pages).toBe(2);
    await expect(prepareProfileImages(form(animation, 'avatar', 'image/webp'))).rejects.toThrow('прочитать');
  });
});
