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

/** Marks the tile now if the photo is already there, otherwise when it loads. */
function watchPhoto(image: HTMLImageElement | null) {
  if (!image) return;
  if (image.complete && image.naturalWidth) { markTile(image); return; }
  const onLoad = () => markTile(image);
  image.addEventListener('load', onLoad);
  return () => image.removeEventListener('load', onLoad);
}

/**
 * A drink photo in a catalog tile: a photo on a white background gives its tile that white, so the photo's own background
 * does not show as a box on the grey tile. A ref, not `onLoad`: next/image does not call `onLoad` for a photo that
 * loaded before hydration — most covers on a server-rendered page. The ref is one stable function: next/image re-binds
 * a ref that changes on every render.
 *
 * Our own covers (`/images/products`, `/brand/products`, member photos) skip the image optimizer: they are ~15 KB
 * 300px JPEGs already, and the optimizer reads its source through the visitor's connection without a timeout — a
 * visitor dropping off during the first resize left that photo hanging for everyone until a restart.
 */
export function CoverImage(props: ImageProps) {
  const local = typeof props.src === 'string' && props.src.startsWith('/');
  return <Image {...props} unoptimized={props.unoptimized ?? local} ref={watchPhoto} />;
}
