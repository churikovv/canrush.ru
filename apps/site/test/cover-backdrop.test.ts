import { describe, expect, it } from 'vitest';
import { whiteBackdropColor } from '../src/lib/cover-backdrop';

const isWhiteBackdrop = (data: Uint8ClampedArray, size: number) => whiteBackdropColor(data, size) !== null;

const SIZE = 8;
const WHITE = [255, 255, 255, 255];
const CAN = [10, 10, 10, 255];

/** An RGBA square: `side` in the two columns at each side, the can in the middle from top to bottom. */
function photo(side: number[], { darkRows = 0 } = {}): Uint8ClampedArray {
  const data = new Uint8ClampedArray(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const onSide = x < 2 || x >= SIZE - 2;
    data.set(onSide && y >= darkRows ? side : CAN, (y * SIZE + x) * 4);
  }
  return data;
}

describe('cover backdrop', () => {
  it('sees a tall can on white even though it touches the top and bottom', () => {
    expect(isWhiteBackdrop(photo(WHITE), SIZE)).toBe(true);
    // Near-white shop backgrounds count too.
    expect(isWhiteBackdrop(photo([240, 241, 244, 255]), SIZE)).toBe(true);
    // The tile takes the photo's own white, so a #f5f5f5 shop backdrop is not framed by pure white.
    expect(whiteBackdropColor(photo([245, 245, 245, 255]), SIZE)).toBe('rgb(245 245 245)');
  });

  it('leaves coloured, grey and transparent backgrounds alone', () => {
    expect(isWhiteBackdrop(photo([0, 110, 255, 255]), SIZE)).toBe(false);
    expect(isWhiteBackdrop(photo([200, 200, 200, 255]), SIZE)).toBe(false);
    expect(isWhiteBackdrop(photo([255, 255, 255, 0]), SIZE)).toBe(false);
    // A dark band across the sides (a photo cropped to the can and something next to it).
    expect(isWhiteBackdrop(photo(WHITE, { darkRows: 2 }), SIZE)).toBe(false);
  });
});
