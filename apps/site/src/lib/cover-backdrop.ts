/**
 * Whether a drink photo sits on a white background: most shop photos are a can on white, and on the grey tile of the
 * catalog (every dark theme keeps the tile light) that white shows as a box. The tile takes the photo's white under such a photo.
 */

/** Edge length of the copy the photo is drawn into: enough to see its border, cheap for a page of cards. */
export const BACKDROP_SAMPLE = 32;
/** A side pixel this light (every channel) and opaque counts as white; a near-white shop backdrop too. */
const WHITE = 236;
/** The share of side pixels that must be white: a label or a shadow may reach the edge here and there. */
const WHITE_SHARE = 0.9;
/** How many columns at each side are read: two, so a JPEG seam on the very edge does not decide alone. */
const SIDE = 2;

/**
 * Reads the sides of an RGBA square `size` wide: when they are (almost) all opaque white, their average colour (a shop
 * «white» is often #f5f5f5, and a pure white tile would frame it), otherwise null. Only the sides: a can is tall and
 * usually touches the top and bottom of a square photo, never its left and right.
 */
export function whiteBackdropColor(data: Uint8ClampedArray, size = BACKDROP_SAMPLE): string | null {
  let white = 0;
  let total = 0;
  const sum = [0, 0, 0];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (x >= SIDE && x < size - SIDE) continue;
      const i = (y * size + x) * 4;
      total++;
      // A transparent side already shows the tile: nothing to hide.
      if (data[i + 3]! >= 250 && data[i]! >= WHITE && data[i + 1]! >= WHITE && data[i + 2]! >= WHITE) {
        white++;
        for (let channel = 0; channel < 3; channel++) sum[channel]! += data[i + channel]!;
      }
    }
  }
  if (!total || white / total < WHITE_SHARE) return null;
  return `rgb(${sum.map(value => Math.round(value / white)).join(' ')})`;
}

/** The colour a photo's tile takes, or null to keep the usual tile; null too when the page may not read the photo. */
export function photoBackdropColor(image: HTMLImageElement): string | null {
  if (!image.naturalWidth || !image.naturalHeight) return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = BACKDROP_SAMPLE;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(image, 0, 0, BACKDROP_SAMPLE, BACKDROP_SAMPLE);
    return whiteBackdropColor(context.getImageData(0, 0, BACKDROP_SAMPLE, BACKDROP_SAMPLE).data);
  } catch {
    // A photo from another origin without CORS taints the canvas: keep the usual tile.
    return null;
  }
}
