'use client';
import Image, { type ImageProps } from 'next/image';
import { photoBackdropColor } from '@/lib/cover-backdrop';

/**
 * Marks the photo's tile once the photo has loaded: `data-backdrop="white"` and the photo's own white
 * (`--cover-backdrop`) when it sits on white.
 */
function markTile(image: HTMLImageElement) {
  const tile = image.parentElement;
  if (!tile) return;
  const colour = photoBackdropColor(image);
  if (colour) {
    tile.dataset.backdrop = 'white';
    tile.style.setProperty('--cover-backdrop', colour);
  } else {
    delete tile.dataset.backdrop;
    tile.style.removeProperty('--cover-backdrop');
  }
}

/**
 * A drink photo in a catalog tile: a photo on a white background gives its tile that white, so the photo's own background
 * does not show as a box on the grey tile. A ref, not `onLoad`: next/image does not call `onLoad` for a photo that
 * loaded before hydration — most covers on a server-rendered page.
 */
export function CoverImage(props: ImageProps) {
  return <Image {...props} ref={image => {
    if (!image) return;
    if (image.complete && image.naturalWidth) { markTile(image); return; }
    const onLoad = () => markTile(image);
    image.addEventListener('load', onLoad);
    return () => image.removeEventListener('load', onLoad);
  }} />;
}
