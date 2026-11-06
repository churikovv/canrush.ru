/**
 * A QR code for a link, without a library: byte mode, error correction level M (15% of the code can be torn or
 * smudged — a poster by a shelf gets both), versions 1–10, which is up to 213 bytes: any link to a drink fits. The
 * algorithm is the standard one (ISO/IEC 18004), written after Project Nayuki's reference generator: data and padding,
 * Reed–Solomon blocks, interleaving, function patterns, and the mask with the lowest penalty.
 */

/** Data codewords' error correction per block and the number of blocks, level M, versions 1–10. */
const ECC_PER_BLOCK = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
const BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
const MAX_VERSION = 10;
/** Level M in the format bits. */
const LEVEL_M = 0;

export interface QrMatrix {
  size: number;
  /** `dark[y][x]`. */
  dark: boolean[][];
}

function rawDataModules(version: number): number {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const align = Math.floor(version / 7) + 2;
    result -= (25 * align - 10) * align - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

const dataCodewords = (version: number) => Math.floor(rawDataModules(version) / 8) - ECC_PER_BLOCK[version]! * BLOCKS[version]!;

function multiply(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function divisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = multiply(result[j]!, root);
      if (j + 1 < degree) result[j]! ^= result[j + 1]!;
    }
    root = multiply(root, 0x02);
  }
  return result;
}

function remainder(data: number[], by: number[]): number[] {
  const result = by.map(() => 0);
  for (const byte of data) {
    const factor = byte ^ result.shift()!;
    result.push(0);
    by.forEach((coefficient, i) => { result[i]! ^= multiply(coefficient, factor); });
  }
  return result;
}

/** The message's codewords: mode, length, the bytes, terminator and padding to the version's capacity. */
function encode(bytes: Uint8Array, version: number): number[] {
  const bits: number[] = [];
  const put = (value: number, length: number) => { for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1); };
  put(0b0100, 4);
  put(bytes.length, version <= 9 ? 8 : 16);
  for (const byte of bytes) put(byte, 8);
  const capacity = dataCodewords(version) * 8;
  put(0, Math.min(4, capacity - bits.length));
  put(0, (8 - bits.length % 8) % 8);
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) put(pad, 8);
  const result: number[] = [];
  for (let i = 0; i < bits.length; i += 8) result.push(bits.slice(i, i + 8).reduce((byte, bit) => (byte << 1) | bit, 0));
  return result;
}

/** Splits the data into blocks, adds each block's error correction and interleaves them. */
function withErrorCorrection(data: number[], version: number): number[] {
  const blocks = BLOCKS[version]!;
  const eccLength = ECC_PER_BLOCK[version]!;
  const raw = Math.floor(rawDataModules(version) / 8);
  const shortBlocks = blocks - raw % blocks;
  const shortLength = Math.floor(raw / blocks);
  const by = divisor(eccLength);
  const all: number[][] = [];
  for (let i = 0, k = 0; i < blocks; i++) {
    const chunk = data.slice(k, k + shortLength - eccLength + (i < shortBlocks ? 0 : 1));
    k += chunk.length;
    const ecc = remainder(chunk, by);
    if (i < shortBlocks) chunk.push(0);
    all.push(chunk.concat(ecc));
  }
  const result: number[] = [];
  for (let i = 0; i < all[0]!.length; i++) {
    all.forEach((block, j) => { if (i !== shortLength - eccLength || j >= shortBlocks) result.push(block[i]!); });
  }
  return result;
}

function alignmentPositions(version: number, size: number): number[] {
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  const step = Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
  const result = [6];
  for (let position = size - 7; result.length < count; position -= step) result.splice(1, 0, position);
  return result;
}

const MASKS: ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_, y) => y % 2 === 0,
  x => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => x * y % 2 + x * y % 3 === 0,
  (x, y) => (x * y % 2 + x * y % 3) % 2 === 0,
  (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0,
];

/** Lower is easier to read: long runs, 2×2 blocks, finder look-alikes and an unbalanced share of dark modules. */
function penalty(dark: boolean[][]): number {
  const size = dark.length;
  let score = 0;
  const lines: boolean[][] = [];
  for (let i = 0; i < size; i++) {
    lines.push(dark[i]!);
    lines.push(dark.map(row => row[i]!));
  }
  const finder = [true, false, true, true, true, false, true];
  for (const line of lines) {
    for (let start = 0; start < size;) {
      let end = start;
      while (end < size && line[end] === line[start]) end++;
      if (end - start >= 5) score += 3 + (end - start - 5);
      start = end;
    }
    const padded = [false, false, false, false, ...line, false, false, false, false];
    for (let i = 4; i + 7 <= padded.length - 4; i++) {
      if (!finder.every((value, k) => padded[i + k] === value)) continue;
      const before = padded.slice(i - 4, i).every(value => !value);
      const after = padded.slice(i + 7, i + 11).every(value => !value);
      if (before) score += 40;
      if (after) score += 40;
    }
  }
  for (let y = 0; y + 1 < size; y++) {
    for (let x = 0; x + 1 < size; x++) {
      const value = dark[y]![x];
      if (dark[y]![x + 1] === value && dark[y + 1]![x] === value && dark[y + 1]![x + 1] === value) score += 3;
    }
  }
  const total = size * size;
  const darkCount = dark.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
  score += (Math.ceil(Math.abs(darkCount * 20 - total * 10) / total) - 1) * 10;
  return score;
}

/** The QR code of a text (a link), as a grid of dark and light modules without the quiet zone. */
export function qrCode(text: string): QrMatrix {
  const bytes = new TextEncoder().encode(text);
  let version = 1;
  while (version <= MAX_VERSION && bytes.length + (version <= 9 ? 2 : 3) > dataCodewords(version)) version++;
  if (version > MAX_VERSION) throw new Error('Ссылка слишком длинная для QR-кода.');
  const size = version * 4 + 17;
  const dark = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const fixed = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const set = (x: number, y: number, value: boolean) => { dark[y]![x] = value; fixed[y]![x] = true; };

  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]] as const) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        set(x, y, distance !== 2 && distance !== 4);
      }
    }
  }
  const aligns = alignmentPositions(version, size);
  const last = aligns.length - 1;
  aligns.forEach((ay, i) => aligns.forEach((ax, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }));
  const drawFormat = (mask: number) => {
    const data = (LEVEL_M << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    const bit = (i: number) => ((bits >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) set(8, i, bit(i));
    set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
    set(8, size - 8, true);
  };
  drawFormat(0);
  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const value = ((bits >>> i) & 1) === 1;
      const a = size - 11 + i % 3, b = Math.floor(i / 3);
      set(a, b, value); set(b, a, value);
    }
  }

  const codewords = withErrorCorrection(encode(bytes, version), version);
  let index = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vertical = 0; vertical < size; vertical++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vertical : vertical;
        if (fixed[y]![x] || index >= codewords.length * 8) continue;
        dark[y]![x] = ((codewords[index >>> 3]! >>> (7 - (index & 7))) & 1) === 1;
        index++;
      }
    }
  }

  const masked = (mask: number) => dark.map((row, y) => row.map((value, x) => fixed[y]![x] ? value : value !== MASKS[mask]!(x, y)));
  let best = 0, bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    drawFormat(mask);
    const score = penalty(masked(mask));
    if (score < bestScore) { best = mask; bestScore = score; }
  }
  drawFormat(best);
  return { size, dark: masked(best) };
}

/** The dark modules as one SVG path, with a quiet zone of `quiet` modules around: `viewBox` is `0 0 side side`. */
export function qrPath(matrix: QrMatrix, quiet = 4): { d: string; side: number } {
  let d = '';
  matrix.dark.forEach((row, y) => {
    for (let x = 0; x < matrix.size; x++) {
      if (!row[x]) continue;
      let end = x;
      while (end + 1 < matrix.size && row[end + 1]) end++;
      d += `M${x + quiet} ${y + quiet}h${end - x + 1}v1h${-(end - x + 1)}z`;
      x = end;
    }
  });
  return { d, side: matrix.size + quiet * 2 };
}

/** A standalone SVG file of the code, for a designer to put on packaging or a stand. */
export function qrSvg(text: string, color = '#000000'): string {
  const { d, side } = qrPath(qrCode(text));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side}" width="${side * 10}" height="${side * 10}" shape-rendering="crispEdges"><rect width="${side}" height="${side}" fill="#ffffff"/><path d="${d}" fill="${color}"/></svg>`;
}
