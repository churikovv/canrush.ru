import { describe, expect, it } from 'vitest';
import { qrCode, qrPath, qrSvg } from '@/lib/qr-code';

/** A finder pattern: 7×7 dark ring, light ring, 3×3 dark core. */
function finderAt(dark: boolean[][], left: number, top: number) {
  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < 7; x++) {
      const ring = Math.max(Math.abs(x - 3), Math.abs(y - 3));
      if (dark[top + y]![left + x] !== (ring !== 2)) return false;
    }
  }
  return true;
}

describe('QR code', () => {
  it('picks the smallest version that holds the link at level M', () => {
    expect(qrCode('https://canrush.ru').size).toBe(25); // 18 bytes: version 2 (26 bytes at M)
    expect(qrCode('a'.repeat(14)).size).toBe(21); // version 1 holds 14 bytes
    expect(qrCode('a'.repeat(15)).size).toBe(25);
    expect(qrCode('a'.repeat(122)).size).toBe(45); // version 7: the version information blocks appear
    expect(qrCode('a'.repeat(213)).size).toBe(57); // version 10, the largest
    expect(() => qrCode('a'.repeat(214))).toThrow('слишком длинная');
  });

  it('draws the function patterns a scanner looks for', () => {
    for (const text of ['https://canrush.ru/catalog/tornado-mango?tab=reviews#write-review', 'a'.repeat(150)]) {
      const { size, dark } = qrCode(text);
      expect(finderAt(dark, 0, 0)).toBe(true);
      expect(finderAt(dark, size - 7, 0)).toBe(true);
      expect(finderAt(dark, 0, size - 7)).toBe(true);
      for (let i = 8; i < size - 8; i++) {
        expect(dark[6]![i]).toBe(i % 2 === 0);
        expect(dark[i]![6]).toBe(i % 2 === 0);
      }
      expect(dark[size - 8]![8]).toBe(true); // the dark module
    }
  });

  it('writes the same format information in both copies', () => {
    const { size, dark } = qrCode('https://canrush.ru/catalog?brand=Tornado');
    const first = [0, 1, 2, 3, 4, 5, 7, 8].map(y => dark[y]![8]).concat([7, 5, 4, 3, 2, 1, 0].map(x => dark[8]![x]));
    const second = Array.from({ length: 8 }, (_, i) => dark[8]![size - 1 - i]).concat(Array.from({ length: 7 }, (_, i) => dark[size - 7 + i]![8]));
    expect(second).toEqual(first);
  });

  it('is the same code every time and a valid standalone SVG', () => {
    const text = 'https://canrush.ru/catalog/burn-mango';
    expect(qrCode(text)).toEqual(qrCode(text));
    const { side, d } = qrPath(qrCode(text));
    expect(side).toBe(qrCode(text).size + 8);
    expect(d.startsWith('M4 4h7')).toBe(true); // the top-left finder's first row, after the quiet zone
    expect(side).toBe(37); // 37 bytes: version 3, 29 modules and the quiet zone
    expect(qrSvg(text).startsWith(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side}"`)).toBe(true);
  });
});
