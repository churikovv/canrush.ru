import { createHash } from 'node:crypto';

export type ErrorSource = 'server' | 'client';

/** One occurrence, already cleaned: this is all that leaves the request. `scope` only takes part in the group hash. */
export interface ErrorReport { source: ErrorSource; path: string; scope: string; message: string; stack: string }

const MESSAGE_LIMIT = 500;
const STACK_LIMIT = 2000;
const STACK_FRAMES = 12;
const PATH_LIMIT = 200;
/** The browser's report as it arrives, before cleaning. */
export const CLIENT_REPORT_LIMIT = 32_000;

const UUID = /(?<![\da-f-])[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}(?![\da-f-])/giu;
const NUMBER = /\+?\d[\d ()-]{7,}\d|\d{5,}/gu;

/** Whatever a message or a stack may carry about a person or a key: URL credentials and queries, mail, tokens. */
function redact(text: string): string {
  return text
    .replace(/\b[a-z][a-z\d+.-]*:\/\/[^\s"'<>)\]]+/giu, url => url.replace(/\/\/[^/@\s]*@/u, '//').replace(/[?#].*?(?=:\d+:\d+$|$)/u, ''))
    .replace(/[^\s"'<>(),;:=]+@[^\s"'<>(),;:=]+\.[a-z]{2,}/giu, '[почта]')
    .replace(/\b(bearer|basic)\s+\S+/giu, '$1 [скрыто]')
    .replace(/\b(password|passwd|pwd|secret|token|api[_-]?key|authorization|cookie)(["']?\s*[:=]\s*["']?)[^\s"',;&]+/giu, '$1$2[скрыто]')
    .replace(UUID, '[id]')
    .replace(/(?<![\w-])[\w-]{32,}(?![\w-])/gu, '[токен]');
}

/**
 * The text of an error, with the cause one level down: «fetch failed» alone says nothing. A thrown non-Error object is
 * not printed: it may be anything, even a request body.
 */
export function errorText(error: unknown): string {
  if (typeof error === 'string') return error;
  if (!(error instanceof Error)) return 'Ошибка без описания';
  const text = error.name && error.name !== 'Error' ? `${error.name}: ${error.message}` : error.message;
  return error.cause instanceof Error ? `${text} ← ${error.cause.message}` : text;
}

/** Numbers and ids go too, so the same failure for different rows is one group. */
export function cleanErrorMessage(text: string): string {
  return redact(text).replace(NUMBER, '[число]').replace(/\s+/gu, ' ').trim().slice(0, MESSAGE_LIMIT) || 'Ошибка без описания';
}

/** Frames only (V8 and Safari/Firefox forms): the first lines of a stack repeat the message, which is cleaned on its own. */
export function cleanErrorStack(stack: unknown): string {
  if (typeof stack !== 'string') return '';
  const frames = stack.split('\n').map(line => line.trim()).filter(line => /^at\s|^[^\s@]*@\S*:\d+:\d+$/u.test(line));
  return redact(frames.slice(0, STACK_FRAMES).join('\n')).slice(0, STACK_LIMIT);
}

/**
 * The path without its query or hash: `/profile/<ник>` hides the nick, ids and long keys hide too. Slugs of drinks stay
 * (hyphens are not a key): they say which page fails.
 */
export function cleanErrorPath(value: string): string {
  const path = value.startsWith('/') ? value.split(/[?#]/u, 1)[0] ?? '/' : '/';
  return path.replace(UUID, '[id]').replace(/(?<![\w-])\w{24,}(?![\w-])/gu, '[токен]').replace(NUMBER, '[id]')
    .replace(/^\/profile\/(?!(?:settings|edit|favorites|tierlists)(?:\/|$))[^/]+/u, '/profile/[ник]').slice(0, PATH_LIMIT);
}

/** Group key. The route is `/catalog/[slug]` on the server; the browser knows only a page, so its first segment stands in. */
export function errorGroupHash({ source, scope, message }: Pick<ErrorReport, 'source' | 'scope' | 'message'>): string {
  return createHash('sha256').update(`${source}\n${scope}\n${message}`).digest('hex').slice(0, 32);
}

export function isErrorGroupHash(value: unknown): value is string {
  return typeof value === 'string' && /^[\da-f]{32}$/u.test(value);
}

/** `redirect()`, `notFound()` and other control flow of Next, and connections the visitor dropped, are not bugs. */
export function isIgnoredError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { digest, name } = error as { digest?: unknown; name?: unknown };
  return (typeof digest === 'string' && /^(?:NEXT_|DYNAMIC_SERVER_USAGE|BAILOUT_TO_CLIENT_SIDE_RENDERING)/u.test(digest))
    || name === 'AbortError' || name === 'ResponseAborted';
}

export function serverErrorReport(error: unknown, requestPath: string, route?: string): ErrorReport {
  const path = cleanErrorPath(requestPath);
  return {
    source: 'server', path, scope: route || `/${path.split('/')[1] ?? ''}`, message: cleanErrorMessage(errorText(error)),
    stack: cleanErrorStack(error instanceof Error ? error.stack : undefined),
  };
}

/** The browser's report: nothing in it is trusted, so it is read field by field and cleaned like a server error. */
export function parseClientErrorReport(body: unknown): ErrorReport | null {
  const { path, message, stack } = (body ?? {}) as { path?: unknown; message?: unknown; stack?: unknown };
  if (typeof path !== 'string' || typeof message !== 'string' || !message.trim()) return null;
  const clean = cleanErrorPath(path);
  return { source: 'client', path: clean, scope: `/${clean.split('/')[1] ?? ''}`, message: cleanErrorMessage(message), stack: cleanErrorStack(stack) };
}
