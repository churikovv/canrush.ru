import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { backdropOf, cutOutCan, cutoutAlpha } from '../src/lib/can-cutout';

/** A shop-like photo: a light grey backdrop, a dark can with a white band that touches its edge, a small badge aside. */
function photo({ backdrop = [244, 244, 244], badge = true } = {}) {
  const width = 120, height = 120;
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const index = (y * width + x) * 4;
    const can = x >= 40 && x < 80 && y >= 10 && y < 110;
    const band = can && y >= 50 && y < 58;
    const mark = badge && Math.hypot(x - 105, y - 15) < 6;
    const [r, g, b] = band ? [255, 255, 255] : can ? [30, 40, 90] : mark ? [200, 200, 200] : backdrop;
    rgba.set([r!, g!, b!, 255], index);
  }
  return { rgba, width, height };
}

describe('a can without its shop background', () => {
  it('floods the backdrop from the edges and keeps the can, its white band included', () => {
    const { rgba, width, height } = photo();
    const alpha = cutoutAlpha(rgba, width, height)!;
    expect(alpha[0]).toBe(0);
    expect(alpha[60 * width + 60]).toBe(255);
    expect(alpha[54 * width + 60]).toBe(255);
  });

  it('fades the outline over a few pixels instead of stepping', () => {
    const { rgba, width, height } = photo();
    const alpha = cutoutAlpha(rgba, width, height)!;
    const row = Array.from({ length: 12 }, (_, step) => alpha[70 * width + 34 + step]!);
    expect(row[0]).toBe(0);
    expect(row.at(-1)).toBe(255);
    expect(row.filter(value => value > 0 && value < 255).length).toBeGreaterThanOrEqual(3);
  });

  it('drops a small badge that stands beside the can', () => {
    const { rgba, width, height } = photo();
    expect(cutoutAlpha(rgba, width, height)![15 * width + 105]).toBe(0);
  });

  it('leaves alone a photo without a plain light backdrop', () => {
    const { rgba, width, height } = photo({ backdrop: [60, 70, 80] });
    expect(backdropOf(rgba, width, height)).toBeNull();
    expect(cutoutAlpha(rgba, width, height)).toBeNull();
  });

  it('gives a transparent WebP trimmed to the can, or a rounded photo when it cannot cut', async () => {
    const { rgba, width, height } = photo();
    const made = await cutOutCan(await sharp(Buffer.from(rgba), { raw: { width, height, channels: 4 } }).png().toBuffer());
    expect(made.cut).toBe(true);
    const cut = await sharp(made.image).metadata();
    expect(cut).toMatchObject({ format: 'webp', hasAlpha: true });
    // Cut at a larger size, then trimmed to the can: as narrow as the can (40 × 100), with a feathered edge.
    expect(cut.width! / cut.height!).toBeLessThan(.5);
    const dark = photo({ backdrop: [60, 70, 80] });
    const shelf = await cutOutCan(await sharp(Buffer.from(dark.rgba), { raw: { width, height, channels: 4 } }).png().toBuffer());
    expect(shelf.cut).toBe(false);
    const kept = await sharp(shelf.image).metadata();
    expect(kept).toMatchObject({ format: 'webp', hasAlpha: true });
    expect(kept.width).toBe(kept.height);
  });
});
