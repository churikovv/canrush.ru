import { nativeImage } from '@/lib/native-app';

/**
 * A picture to share: the app's share sheet, the system sheet with a file on phones, a PNG download elsewhere. Used by
 * «Твоя неделя» in stories and «Твой вкус» at the end of the dating deck.
 */
export async function shareImage(blob: Blob, fileName: string, title: string): Promise<'shared' | 'saved' | 'cancelled'> {
  const image = nativeImage();
  if (image) { await image.share(blob, fileName, title); return 'shared'; }
  const file = new File([blob], fileName, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title }); return 'shared'; }
    catch (error) { if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'; }
  }
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), { href: url, download: fileName });
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'saved';
}
