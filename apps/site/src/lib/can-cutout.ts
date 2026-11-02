import sharp from 'sharp';

/**
 * A can without its shop background, for the big Bankomat cards: shop photos stand on white or light grey, and on a card
 * the can should float over the card's own look. The background is flooded from the photo's edges — only pixels close to
 * the backdrop colour and joined to the edge go — so a white or silver can keeps its body (its outline stops the flood).
 * A photo that is not on a plain light backdrop (a can on a shelf) is not cut: it keeps its picture with rounded corners.
 * The edge is feathered and cleaned of the backdrop's light (`softAlpha`, `cleanEdges`), so it neither steps nor glows.
 */

/**
 * How far a pixel may be from the backdrop and still be flooded (sum of the three channel differences). Tight on purpose:
 * at 42 the flood ran into white logos that touch a can's edge (Flash's bolt) and cut holes in it; the soft rim below
 * takes care of the backdrop's noise.
 */
const FLOOD = 24;
/** The cut is made at this size: a 300 px shop photo is enlarged first, so the soft edge is drawn finer than its pixels. */
const SIDE = 640;
/** How far the edge fades, in pixels at `SIDE`: a box blur of the mask, twice, is close to a Gaussian. */
const FEATHER = 2;

/** The backdrop if the photo has one: the median of its border, when it is light and most of the border agrees. */
export function backdropOf(rgba: Uint8Array, width: number, height: number): [number, number, number] | null {
  const border: number[] = [];
  for (let x = 0; x < width; x++) border.push(x, (height - 1) * width + x);
  for (let y = 1; y < height - 1; y++) border.push(y * width, y * width + width - 1);
  const channel = (offset: number) => border.map(index => rgba[index * 4 + offset]!).sort((a, b) => a - b)[border.length >> 1]!;
  const colour: [number, number, number] = [channel(0), channel(1), channel(2)];
  if ((colour[0] + colour[1] + colour[2]) / 3 < 200) return null;
  const agree = border.filter(index => distance(rgba, index, colour) <= FLOOD).length / border.length;
  return agree >= .8 ? colour : null;
}

const distance = (rgba: Uint8Array, index: number, [r, g, b]: [number, number, number]) =>
  Math.abs(rgba[index * 4]! - r) + Math.abs(rgba[index * 4 + 1]! - g) + Math.abs(rgba[index * 4 + 2]! - b);

/** The flooded backdrop (1) and its colour, or null when the photo has no plain backdrop or the flood took too little or too much. */
export function cutoutMask(rgba: Uint8Array, width: number, height: number): { background: Uint8Array; backdrop: [number, number, number] } | null {
  const backdrop = backdropOf(rgba, width, height);
  if (!backdrop) return null;
  const total = width * height;
  const background = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0, tail = 0;
  const visit = (index: number) => {
    if (background[index] || distance(rgba, index, backdrop) > FLOOD) return;
    background[index] = 1;
    queue[tail++] = index;
  };
  for (let x = 0; x < width; x++) { visit(x); visit((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { visit(y * width); visit(y * width + width - 1); }
  while (head < tail) {
    const index = queue[head++]!;
    const x = index % width;
    if (x > 0) visit(index - 1);
    if (x < width - 1) visit(index + 1);
    if (index >= width) visit(index - width);
    if (index < total - width) visit(index + width);
  }
  const share = tail / total;
  if (share < .2 || share > .94) return null;
  dropSpecks(background, width, height);
  return { background, backdrop };
}

/** A box blur of `radius` along rows, then columns: running sums in plain loops, so it costs the same for any radius. */
function boxBlur(values: Float32Array, width: number, height: number, radius: number): Float32Array {
  const span = radius * 2 + 1;
  const rows = new Float32Array(values.length);
  for (let y = 0; y < height; y++) {
    const line = y * width;
    let sum = 0;
    for (let step = -radius; step <= radius; step++) sum += values[line + Math.min(width - 1, Math.max(0, step))]!;
    for (let x = 0; x < width; x++) {
      rows[line + x] = sum / span;
      sum += values[line + Math.min(width - 1, x + radius + 1)]! - values[line + Math.max(0, x - radius)]!;
    }
  }
  const out = new Float32Array(values.length);
  for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let step = -radius; step <= radius; step++) sum += rows[Math.min(height - 1, Math.max(0, step)) * width + x]!;
    for (let y = 0; y < height; y++) {
      out[y * width + x] = sum / span;
      sum += rows[Math.min(height - 1, y + radius + 1) * width + x]! - rows[Math.max(0, y - radius) * width + x]!;
    }
  }
  return out;
}

/**
 * The alpha of each pixel, 0–255: the mask blurred twice by `FEATHER`, so the outline fades over a few pixels instead of
 * stepping. Null when the photo cannot be cut.
 */
export function cutoutAlpha(rgba: Uint8Array, width: number, height: number): Uint8Array | null {
  const mask = cutoutMask(rgba, width, height);
  if (!mask) return null;
  return softAlpha(mask.background, width, height);
}

function softAlpha(background: Uint8Array, width: number, height: number): Uint8Array {
  const solid = Float32Array.from(background, value => (value ? 0 : 1));
  const soft = boxBlur(boxBlur(solid, width, height, FEATHER), width, height, FEATHER);
  return Uint8Array.from(soft, value => (value > .985 ? 255 : value < .015 ? 0 : Math.round(value * 255)));
}

/**
 * Edge pixels keep the backdrop's light in their colour, which shows as a pale rim on a dark card. A see-through pixel of
 * the can gets the backdrop taken out of its colour; one of the backdrop gets the colour of the can beside it.
 */
function cleanEdges(rgba: Uint8Array, background: Uint8Array, alpha: Uint8Array, width: number, height: number, [r, g, b]: [number, number, number]) {
  const reach = FEATHER * 2 + 1;
  for (let index = 0; index < alpha.length; index++) {
    const a = alpha[index]! / 255;
    if (a === 0 || a === 1) continue;
    const at = index * 4;
    if (!background[index]) {
      const keep = Math.max(a, .35);
      rgba[at] = Math.max(0, Math.min(255, (rgba[at]! - (1 - keep) * r) / keep));
      rgba[at + 1] = Math.max(0, Math.min(255, (rgba[at + 1]! - (1 - keep) * g) / keep));
      rgba[at + 2] = Math.max(0, Math.min(255, (rgba[at + 2]! - (1 - keep) * b) / keep));
      continue;
    }
    const x = index % width, y = Math.floor(index / width);
    search: for (let distanceAway = 1; distanceAway <= reach; distanceAway++) {
      for (const [dx, dy] of [[distanceAway, 0], [-distanceAway, 0], [0, distanceAway], [0, -distanceAway], [distanceAway, distanceAway], [-distanceAway, -distanceAway], [distanceAway, -distanceAway], [-distanceAway, distanceAway]] as const) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const near = ny * width + nx;
        if (background[near]) continue;
        rgba.copyWithin(at, near * 4, near * 4 + 3);
        break search;
      }
    }
  }
}

/**
 * What is left apart from the can and much smaller than it — a shop's «18+» badge, a stray glint — joins the background.
 * Pieces are found on the silhouette shrunk by `NECK` pixels, so a thin line of shadow does not tie a badge to the can,
 * and the kept pieces then get their edge back.
 */
const SPECK = .15;
const NECK = 2;
function dropSpecks(background: Uint8Array, width: number, height: number) {
  const total = width * height;
  const shrink = (mask: Uint8Array) => mask.map((solid, index) => {
    if (!solid) return 0;
    const x = index % width;
    return x > 0 && x < width - 1 && index >= width && index < total - width && mask[index - 1] && mask[index + 1] && mask[index - width] && mask[index + width] ? 1 : 0;
  });
  const grow = (mask: Uint8Array) => mask.map((solid, index) => {
    if (solid) return 1;
    const x = index % width;
    return (x > 0 && mask[index - 1]) || (x < width - 1 && mask[index + 1]) || (index >= width && mask[index - width]) || (index < total - width && mask[index + width]) ? 1 : 0;
  });
  let core = background.map(value => (value ? 0 : 1));
  for (let step = 0; step < NECK; step++) core = shrink(core);
  const label = new Int32Array(total).fill(-1);
  const pieces: { size: number; left: number; right: number }[] = [];
  const queue = new Int32Array(total);
  for (let start = 0; start < total; start++) {
    if (!core[start] || label[start] !== -1) continue;
    const id = pieces.length;
    const piece = { size: 0, left: width, right: 0 };
    let head = 0, tail = 0;
    label[start] = id;
    queue[tail++] = start;
    while (head < tail) {
      const index = queue[head++]!;
      const x = index % width;
      piece.left = Math.min(piece.left, x);
      piece.right = Math.max(piece.right, x);
      for (const next of [x > 0 ? index - 1 : -1, x < width - 1 ? index + 1 : -1, index - width, index + width]) {
        if (next < 0 || next >= total || !core[next] || label[next] !== -1) continue;
        label[next] = id;
        queue[tail++] = next;
      }
    }
    piece.size = tail;
    pieces.push(piece);
  }
  if (!pieces.length) return;
  const main = pieces.reduce((best, piece) => (piece.size > best.size ? piece : best));
  const solid = pieces.reduce((sum, piece) => sum + piece.size, 0);
  // A badge stands beside the can; a piece of the can itself (cut off by a light logo) stays within its width.
  const keeps = pieces.map(piece => piece.size >= main.size * SPECK && (piece.size >= solid * .3 || (piece.left <= main.right && piece.right >= main.left)));
  let kept: Uint8Array = core.map((solid, index) => (solid && keeps[label[index]!] ? 1 : 0));
  for (let step = 0; step < NECK + 1; step++) kept = grow(kept);
  for (let index = 0; index < total; index++) if (!background[index] && !kept[index]) background[index] = 1;
}

/**
 * The cut-out can as WebP with transparency; a photo that cannot be cut keeps its picture inside rounded corners. `cut`
 * says which: only a cut can is drawn round in the big view (`CanVolume`) — a shelf photo wrapped on a cylinder would bend.
 */
export async function cutOutCan(bytes: Buffer): Promise<{ image: Buffer; cut: boolean }> {
  const { data, info } = await sharp(bytes, { limitInputPixels: 40_000_000 }).rotate()
    .resize({ width: SIDE, height: SIDE, fit: 'inside', kernel: 'lanczos3' }).flatten({ background: '#ffffff' }).ensureAlpha()
    .raw().toBuffer({ resolveWithObject: true });
  const rgba = new Uint8Array(data.buffer, data.byteOffset, data.length);
  const mask = cutoutMask(rgba, info.width, info.height);
  if (mask) {
    const alpha = softAlpha(mask.background, info.width, info.height);
    cleanEdges(rgba, mask.background, alpha, info.width, info.height, mask.backdrop);
    for (let index = 0; index < alpha.length; index++) rgba[index * 4 + 3] = alpha[index]!;
    return { image: await sharp(Buffer.from(rgba), { raw: { width: info.width, height: info.height, channels: 4 } }).trim({ threshold: 1 }).webp({ quality: 86, alphaQuality: 100, effort: 2 }).toBuffer(), cut: true };
  }
  const radius = Math.round(Math.min(info.width, info.height) * .08);
  const corners = Buffer.from(`<svg width="${info.width}" height="${info.height}"><rect width="100%" height="100%" rx="${radius}" ry="${radius}"/></svg>`);
  return { image: await sharp(Buffer.from(rgba), { raw: { width: info.width, height: info.height, channels: 4 } }).composite([{ input: corners, blend: 'dest-in' }]).webp({ quality: 86, alphaQuality: 100, effort: 2 }).toBuffer(), cut: false };
}
