import type { ClipboardEvent } from 'react';

/**
 * Files pasted with Ctrl/⌘+V (a screenshot, a copied image or files from the file manager). Returns them only when
 * the clipboard holds files, and then stops the default paste so their names do not land in the text.
 */
export function pastedFiles(event: ClipboardEvent, accept?: (file: File) => boolean): File[] {
  const data = event.clipboardData;
  if (!data) return [];
  const files = data.files.length ? Array.from(data.files)
    : Array.from(data.items).filter(item => item.kind === 'file').map(item => item.getAsFile()).filter((file): file is File => Boolean(file));
  const picked = accept ? files.filter(accept) : files;
  if (picked.length) event.preventDefault();
  return picked;
}

/** A file list for an `<input type="file">`, so pasted files reach forms that read the input itself. */
export function toFileList(files: readonly File[]): FileList {
  const transfer = new DataTransfer();
  for (const file of files) transfer.items.add(file);
  return transfer.files;
}
