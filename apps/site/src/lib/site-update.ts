/**
 * A page of the previous build after a deploy. Next gives server actions new ids in every build and the new image has
 * only its own scripts, so an open page keeps failing — its server actions answer «not found» (header
 * `x-nextjs-action-not-found`), a script it loads late is gone — while Next itself reloads only on a link. The page then
 * reloads itself (`SiteUpdate` in the root layout), unless the member is in the middle of something.
 */

/** The answer Next gives a server action of another build. */
export const ACTION_NOT_FOUND_HEADER = 'x-nextjs-action-not-found';

const STALE = /Server Action .* was not found|Failed to find Server Action|Failed to load chunk|Loading chunk|ChunkLoadError|dynamically imported module/i;

/** An error that only means the page belongs to an older build: a server action or a script the server no longer has. */
export function isStaleBuildError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === 'ChunkLoadError' || error.name === 'UnrecognizedActionError' || STALE.test(error.message);
}

let updated = false;
const listeners = new Set<() => void>();

/** The site has a newer build than this page: everyone listening hears it once. */
export function markSiteUpdated(): void {
  if (updated) return;
  updated = true;
  for (const listener of listeners) listener();
}

export function onSiteUpdated(listener: () => void): () => void {
  listeners.add(listener);
  if (updated) listener();
  return () => { listeners.delete(listener); };
}

const KEY = 'canrush-site-update';
/** No second automatic reload within this time: during the deploy itself a reload can land on the old server once more. */
const RELOAD_PAUSE_MS = 60_000;

/**
 * Reloads the page for the new build and remembers where it was scrolled, so `restoreUpdateScroll` brings the reader
 * back. Returns false without reloading if it already reloaded a moment ago — then the page asks the member instead.
 */
export function reloadForUpdate(): boolean {
  try {
    const last = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as { at?: number } | null;
    if (last?.at && Date.now() - last.at < RELOAD_PAUSE_MS) return false;
    sessionStorage.setItem(KEY, JSON.stringify({ at: Date.now(), path: location.pathname + location.search, y: Math.round(window.scrollY) }));
  } catch { /* without storage the page still reloads, from the top */ }
  location.reload();
  return true;
}

/** After an update reload: the page scrolls back to where the reader was. */
export function restoreUpdateScroll(): void {
  let saved: { at?: number; path?: string; y?: number } | null = null;
  try { saved = JSON.parse(sessionStorage.getItem(KEY) ?? 'null'); } catch { return; }
  if (!saved?.y || saved.path !== location.pathname + location.search || !saved.at || Date.now() - saved.at > 30_000) return;
  const y = saved.y;
  // The pause before another reload stays; the position is used once.
  try { sessionStorage.setItem(KEY, JSON.stringify({ at: saved.at })); } catch { /* nothing to keep */ }
  requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'instant' })));
}

const NOT_TEXT = new Set(['checkbox', 'radio', 'range', 'button', 'submit', 'reset', 'file', 'color', 'hidden', 'image']);

/** A field the member types into, as opposed to a switch or a button. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (target instanceof HTMLInputElement) return !NOT_TEXT.has(target.type);
  return target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable);
}

/**
 * The member is in the middle of something a reload would lose: an open window (a sheet, the chat), a text written in
 * any text area or editable block, or a field typed into since the last sent form (`typed`).
 */
export function pageBusy(typed: boolean): boolean {
  if (typed || openModal()) return true;
  for (const area of document.querySelectorAll('textarea')) if (area.value.trim()) return true;
  for (const block of document.querySelectorAll<HTMLElement>('[contenteditable="true"], [contenteditable=""]')) if (block.textContent?.trim()) return true;
  return false;
}

/** The window open on top, if any: the update notice goes inside it, or it would sit under the window and not take taps. */
export function openModal(): HTMLElement | null {
  try { return document.querySelector<HTMLElement>('dialog:modal'); } catch { return document.querySelector<HTMLElement>('dialog[open]'); }
}
