const LETTERS = [
  ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  ['10001', '11001', '11001', '10101', '10011', '10011', '10001'],
  ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
];
export const LOADING_WORD = 'Canrush';
export const LOADING_CYCLE_MS = 6300;
export const LOADING_GLYPHS = LETTERS.map(rows => rows.flatMap((row, y) => [...row].flatMap((cell, x) => cell === '1' ? [{ x: x * 32 + 3, y: y * 32 + 3 }] : [])));
export const LOADING_BLOCK_COUNT = Math.max(...LOADING_GLYPHS.map(glyph => glyph.length));
export function loadingBlockPosition(block: number, letter: number) {
  const glyph = LOADING_GLYPHS[letter % LOADING_GLYPHS.length]!;
  return glyph[block % glyph.length]!;
}
export function loadingBlockFrames(block: number): Keyframe[] {
  const frames = LOADING_GLYPHS.flatMap((_, index) => {
    const point = loadingBlockPosition(block, index);
    const frame = { transform: `translate(${point.x}px, ${point.y}px)`, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' };
    return [{ ...frame, offset: index / 7 }, { ...frame, offset: (index + 0.55) / 7 }];
  });
  return [...frames, { ...frames[0], offset: 1 }];
}
