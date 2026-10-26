'use client';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent, type ReactNode } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Link from '@/components/navigation-progress';
import { deleteDraftAction, saveArticleAction, submitArticleAction, uploadArticleImageAction } from '@/app/news/actions';
import { FormAlert } from '@/components/form-alert';
import { StoreDrinkPicker } from '@/components/store-drink-picker';
import {
  ARTICLE_TITLE_MAX, BLOCK_MENU, TEXT_COLORS, isTextBlock, newBlockId, articleReadiness, safeHref, sanitizeInline,
  type ArticleBlock, type ArticleBlockType, type TextBlockType, type TextColor,
} from '@/lib/article-fields';
import type { StoreDrinkOption } from '@/lib/store-catalog';

export interface ArticleDraft { id: string | null; title: string; blocks: ArticleBlock[]; coverId: string | null; version: string | null; telegramChannel?: string | null; moderationNote?: string }
const CHANNEL = /^[a-z][a-z0-9_]{4,31}$/i;
const bareChannel = (value: string) => value.trim().replace(/^https?:\/\//i, '').replace(/^(?:t\.me|telegram\.me)\//i, '').replace(/^@+/, '').replace(/\/$/, '');

type TextBlock = Extract<ArticleBlock, { text: string }>;
const NOTHING_TAKEN = new Set<string>();
const LIST_TYPES = new Set<ArticleBlockType>(['bulleted', 'numbered', 'todo']);
/** What Enter continues with: lists go on, everything else starts a paragraph. */
const nextType = (type: TextBlockType): TextBlockType => LIST_TYPES.has(type) ? type : 'paragraph';
const MARKDOWN: [RegExp, TextBlockType][] = [[/^###[\s ]/, 'heading3'], [/^##[\s ]/, 'heading2'], [/^#[\s ]/, 'heading1'], [/^[-*•][\s ]/, 'bulleted'],
  [/^1[.)][\s ]/, 'numbered'], [/^\[\s?\][\s ]/, 'todo'], [/^>[\s ]/, 'quote'], [/^!![\s ]/, 'callout']];
const PLACEHOLDERS: Partial<Record<TextBlockType, string>> = { heading1: 'Заголовок 1', heading2: 'Заголовок 2', heading3: 'Заголовок 3', bulleted: 'Пункт списка', numbered: 'Пункт списка', todo: 'Задача', quote: 'Цитата', callout: 'Важная заметка' };

// ——— caret helpers: contenteditable blocks are plain DOM, React only owns the list of blocks ———

function caretRange(element: HTMLElement): Range | null {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return null;
  const range = selection.getRangeAt(0);
  return element.contains(range.startContainer) ? range : null;
}
/** Characters before the caret inside the block. */
function caretOffset(element: HTMLElement): number {
  const range = caretRange(element);
  if (!range) return 0;
  const before = document.createRange();
  before.selectNodeContents(element);
  before.setEnd(range.startContainer, range.startOffset);
  return before.toString().length;
}
function setCaret(element: HTMLElement, offset: number | 'end') {
  element.focus({ preventScroll: true });
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let left = offset === 'end' ? Infinity : offset;
  let last: Text | null = null;
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    last = node;
    if (left <= node.length) { range.setStart(node, left); range.collapse(true); selection.removeAllRanges(); selection.addRange(range); return; }
    left -= node.length;
  }
  if (last) range.setStart(last, last.length); else range.setStart(element, element.childNodes.length);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}
function caretAtStart(element: HTMLElement) { const range = caretRange(element); return !!range && range.collapsed && caretOffset(element) === 0; }
function caretAtEnd(element: HTMLElement) {
  const range = caretRange(element);
  if (!range?.collapsed) return false;
  const after = document.createRange();
  after.selectNodeContents(element);
  after.setStart(range.endContainer, range.endOffset);
  return after.toString().length === 0;
}
/** Whether the caret sits on the first (or last) visual line, for arrow keys between blocks. */
function caretOnEdgeLine(element: HTMLElement, edge: 'top' | 'bottom') {
  const range = caretRange(element);
  if (!range) return false;
  const rect = range.getClientRects()[0];
  if (!rect) return edge === 'top' ? caretAtStart(element) : caretAtEnd(element);
  const box = element.getBoundingClientRect();
  return edge === 'top' ? rect.top - box.top < rect.height : box.bottom - rect.bottom < rect.height;
}
const htmlOf = (fragment: DocumentFragment) => { const holder = document.createElement('div'); holder.appendChild(fragment); return holder.innerHTML; };
const isEmptyHtml = (html: string) => !html.replace(/<br\s*\/?>/gi, '').replace(/<[^>]*>/g, '').replace(/&nbsp;| /g, '').trim();

// ——— one text block: the DOM is filled once on mount; typing goes straight to the DOM and is read back on input ———

interface TextBlockProps {
  block: TextBlock; number: number; first: boolean;
  register: (id: string, element: HTMLDivElement | null) => void;
  onInput: (id: string) => void; onKeyDown: (event: KeyboardEvent<HTMLDivElement>, id: string) => void;
  onPaste: (event: ClipboardEvent<HTMLDivElement>, id: string) => void; onFocus: (id: string) => void; onToggle: (id: string) => void;
}
const EditableText = memo(function EditableText({ block, number, first, register, onInput, onKeyDown, onPaste, onFocus, onToggle }: TextBlockProps) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = ref.current!;
    element.innerHTML = block.text;
    element.toggleAttribute('data-empty', isEmptyHtml(block.text));
    register(block.id, element);
    return () => register(block.id, null);
    // The text is only written on mount: afterwards the DOM is the source and the state follows it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const placeholder = PLACEHOLDERS[block.type] ?? (first ? 'Начните писать или нажмите «/» для блоков' : 'Текст или «/» для блоков');
  return <div className="ae-text-row" data-type={block.type}>
    {block.type === 'bulleted' && <span className="ae-marker" aria-hidden="true">•</span>}
    {block.type === 'numbered' && <span className="ae-marker" aria-hidden="true">{number}.</span>}
    {block.type === 'todo' && <button type="button" className="ae-check" role="checkbox" aria-checked={block.checked === true} aria-label="Выполнено" onClick={() => onToggle(block.id)} />}
    {block.type === 'callout' && <span className="ae-marker" aria-hidden="true">💡</span>}
    <div ref={ref} className="ae-text" data-type={block.type} data-checked={block.type === 'todo' && block.checked ? '' : undefined}
      contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label={BLOCK_MENU.find(item => item.type === block.type)?.label}
      data-placeholder={placeholder} spellCheck
      onInput={() => onInput(block.id)} onKeyDown={event => onKeyDown(event, block.id)} onPaste={event => onPaste(event, block.id)} onFocus={() => onFocus(block.id)} />
  </div>;
});

// ——— the «/» menu and the block menu share the list of block types ———

function filterMenu(query: string) {
  const q = query.trim().toLowerCase();
  return q ? BLOCK_MENU.filter(item => item.label.toLowerCase().includes(q) || item.keywords.includes(q)) : BLOCK_MENU;
}
const ICONS: Record<ArticleBlockType, ReactNode> = {
  paragraph: 'Аа', heading1: 'H1', heading2: 'H2', heading3: 'H3', bulleted: '•', numbered: '1.', todo: '☑', quote: '❝', callout: '💡', divider: '—', image: '🖼', drink: '⚡',
};

/**
 * The Notion-like article editor. Each text block is its own contenteditable; Enter splits a block, Backspace at the
 * start merges it into the previous one, arrows move between blocks, «/» opens the block menu, markdown at the start of a
 * line («# », «- », «1. », «[] », «> », «---») turns the block into its type, a selection shows the format bar. Blocks
 * are dragged by the handle on the left (on phones moved with the toolbar). The draft saves itself.
 */
export function ArticleEditor({ initial, options, profileChannel = null }: { initial: ArticleDraft; options: StoreDrinkOption[]; profileChannel?: string | null }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  // The first block of an empty article has a fixed id: a random one would differ between the server render and hydration.
  const [blocks, setBlocks] = useState<ArticleBlock[]>(() => initial.blocks.length ? initial.blocks : [{ id: 'first', type: 'paragraph', text: '' }]);
  const [coverId, setCoverId] = useState(initial.coverId);
  const [channel, setChannel] = useState(initial.telegramChannel ?? '');
  const [channelOpen, setChannelOpen] = useState(Boolean(initial.telegramChannel));
  const channelValid = !channel || CHANNEL.test(channel);
  const [state, setState] = useState<{ saving: boolean; dirty: boolean; error: string; savedAt: Date | null }>({ saving: false, dirty: false, error: '', savedAt: null });
  const [menu, setMenu] = useState<{ id: string; query: string; index: number } | null>(null);
  const [blockMenu, setBlockMenu] = useState<string | null>(null);
  const [picking, setPicking] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; over: string | null; after: boolean } | null>(null);
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const elements = useRef(new Map<string, HTMLDivElement>());
  const blocksRef = useRef(blocks);
  useLayoutEffect(() => { blocksRef.current = blocks; }, [blocks]);
  const doc = useRef({ id: initial.id, version: initial.version });
  const [articleId, setArticleId] = useState(initial.id);
  const pendingFocus = useRef<{ id: string; offset: number | 'end' } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef<string | null>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const changed = useRef(0);

  const register = useCallback((id: string, element: HTMLDivElement | null) => { if (element) elements.current.set(id, element); else elements.current.delete(id); }, []);
  const touch = useCallback(() => { changed.current++; setState(current => current.dirty ? current : { ...current, dirty: true }); }, []);
  const update = useCallback((next: (current: ArticleBlock[]) => ArticleBlock[]) => { setBlocks(current => { const value = next(current); blocksRef.current = value; return value; }); touch(); }, [touch]);
  const focus = useCallback((id: string, offset: number | 'end' = 'end') => { pendingFocus.current = { id, offset }; }, []);

  useLayoutEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    const element = elements.current.get(target.id);
    if (element) { pendingFocus.current = null; setCaret(element, target.offset); element.scrollIntoView({ block: 'nearest' }); return; }
    const row = document.querySelector<HTMLElement>(`[data-block-row="${target.id}"]`);
    if (row) { pendingFocus.current = null; row.focus(); }
  });

  /** The DOM of every text block back into the document, sanitised, for saving. */
  const snapshot = useCallback(() => blocksRef.current.map(block => {
    if (!isTextBlock(block.type)) return block;
    const element = elements.current.get(block.id);
    return { ...block, text: sanitizeInline(element ? element.innerHTML : (block as TextBlock).text) } as ArticleBlock;
  }), []);

  // ——— saving ———
  const saving = useRef<Promise<string | null> | null>(null);
  const save = useCallback(async (): Promise<string | null> => {
    if (saving.current) await saving.current;
    const round = changed.current;
    const run = (async () => {
      setState(current => ({ ...current, saving: true, error: '' }));
      // A channel being typed and not valid yet is not sent: the field says why, the rest still saves.
      const result = await saveArticleAction(doc.current.id, title, snapshot(), coverId, doc.current.version, CHANNEL.test(channel) ? channel : null).catch(() => ({ error: 'Нет связи с сервером. Правки остались в редакторе — сохраним, когда связь вернётся.' } as { id?: string; version?: string; error?: string }));
      if (result.error || !result.id) { setState(current => ({ ...current, saving: false, error: result.error ?? 'Не удалось сохранить.' })); return null; }
      const created = !doc.current.id;
      doc.current = { id: result.id, version: result.version ?? null };
      // Same route, only a query: a new path would make the router mount the edit page and drop what is being typed.
      if (created) { window.history.replaceState(null, '', `/news/new?id=${result.id}`); setArticleId(result.id); }
      setState(current => ({ saving: false, error: '', savedAt: new Date(), dirty: changed.current !== round ? current.dirty : false }));
      return result.id;
    })();
    saving.current = run;
    try { return await run; } finally { if (saving.current === run) saving.current = null; }
  }, [title, coverId, channel, snapshot]);

  useEffect(() => {
    if (!state.dirty || state.error) return;
    const timer = window.setTimeout(() => { void save(); }, 1200);
    return () => clearTimeout(timer);
  }, [state.dirty, state.error, blocks, title, coverId, channel, save]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (state.dirty || state.saving) event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [state.dirty, state.saving]);

  // ——— block operations ———
  const insertAfter = useCallback((id: string | null, block: ArticleBlock) => {
    update(current => {
      const at = id ? current.findIndex(item => item.id === id) : current.length - 1;
      return [...current.slice(0, at + 1), block, ...current.slice(at + 1)];
    });
  }, [update]);
  const setType = useCallback((id: string, type: TextBlockType) => update(current => current.map(block => block.id === id && 'text' in block ? { ...block, type, ...(type === 'todo' ? { checked: false } : {}) } as ArticleBlock : block)), [update]);
  const remove = useCallback((id: string) => {
    const list = blocksRef.current;
    const at = list.findIndex(block => block.id === id);
    const neighbour = list[at - 1] ?? list[at + 1];
    update(current => {
      const rest = current.filter(block => block.id !== id);
      return rest.length ? rest : [{ id: newBlockId(), type: 'paragraph', text: '' }];
    });
    if (neighbour) focus(neighbour.id);
  }, [update, focus]);
  const move = useCallback((id: string, by: -1 | 1) => {
    update(current => {
      const at = current.findIndex(block => block.id === id);
      const to = at + by;
      if (at < 0 || to < 0 || to >= current.length) return current;
      const next = [...current];
      [next[at], next[to]] = [next[to]!, next[at]!];
      return next;
    });
    focus(id, 'end');
  }, [update, focus]);
  const duplicate = useCallback((id: string) => {
    const source = snapshot().find(block => block.id === id);
    if (!source) return;
    const copy = { ...source, id: newBlockId() };
    insertAfter(id, copy);
    if (isTextBlock(copy.type)) window.requestAnimationFrame(() => { const element = elements.current.get(copy.id); if (element) element.innerHTML = (copy as TextBlock).text; });
  }, [snapshot, insertAfter]);

  /** Applies a pick from the «/» menu or the block menu to a block. */
  const apply = useCallback((id: string, type: ArticleBlockType) => {
    setMenu(null); setBlockMenu(null);
    const element = elements.current.get(id);
    const block = blocksRef.current.find(item => item.id === id);
    const empty = !element || isEmptyHtml(element.innerHTML);
    if (isTextBlock(type)) {
      if (block && 'text' in block) { setType(id, type); focus(id, 'end'); }
      return;
    }
    // An object takes an empty block's place, otherwise it goes after it.
    const place = (object: ArticleBlock) => {
      if (empty && block && 'text' in block) update(current => current.map(item => item.id === id ? object : item));
      else insertAfter(id, object);
      return object.id;
    };
    if (type === 'divider') {
      const divider = place({ id: newBlockId(), type: 'divider' });
      const paragraph: ArticleBlock = { id: newBlockId(), type: 'paragraph', text: '' };
      insertAfter(divider, paragraph);
      focus(paragraph.id, 0);
    } else if (type === 'image') {
      uploadTarget.current = id;
      fileInput.current?.click();
    } else if (type === 'drink') setPicking(id);
  }, [setType, update, insertAfter, focus]);

  const onToggle = useCallback((id: string) => update(current => current.map(block => block.id === id && block.type === 'todo' ? { ...block, checked: !block.checked } : block)), [update]);

  const onInput = useCallback((id: string) => {
    const element = elements.current.get(id);
    const block = blocksRef.current.find(item => item.id === id);
    if (!element || !block || !('text' in block)) return;
    element.toggleAttribute('data-empty', isEmptyHtml(element.innerHTML));
    const text = element.textContent ?? '';
    // Markdown at the start of a paragraph turns it into its block.
    if (block.type === 'paragraph') {
      if (/^(---|—-|——)$/.test(text)) { element.innerHTML = ''; apply(id, 'divider'); return; }
      for (const [pattern, type] of MARKDOWN) {
        if (pattern.test(text)) {
          // The caret keeps its place in the text: a keyboard may commit a whole word together with the prefix.
          const prefix = (pattern.exec(text)?.[0] ?? '').length;
          const offset = Math.max(0, caretOffset(element) - prefix);
          const html = element.innerHTML.replace(/^(#{1,3}|[-*•]|1[.)]|\[\s?\]|&gt;|!!)(\s|&nbsp;)/, '');
          element.innerHTML = html;
          element.toggleAttribute('data-empty', isEmptyHtml(html));
          setType(id, type);
          setCaret(element, offset);
          update(current => current.map(item => item.id === id && 'text' in item ? { ...item, text: html } : item));
          return;
        }
      }
    }
    if (text.startsWith('/')) setMenu(current => ({ id, query: text.slice(1), index: current?.id === id ? Math.min(current.index, filterMenu(text.slice(1)).length - 1) : 0 }));
    else setMenu(current => current?.id === id ? null : current);
    update(current => current.map(item => item.id === id && 'text' in item ? { ...item, text: element.innerHTML } : item));
  }, [apply, setType, update]);

  const onKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>, id: string) => {
    const element = elements.current.get(id);
    const list = blocksRef.current;
    const at = list.findIndex(block => block.id === id);
    const block = list[at];
    if (!element || !block || !('text' in block)) return;

    if (menu?.id === id) {
      const items = filterMenu(menu.query);
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setMenu({ ...menu, index: (menu.index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % Math.max(1, items.length) }); return; }
      if (event.key === 'Escape') { event.preventDefault(); setMenu(null); return; }
      if (event.key === 'Enter' && items.length) {
        event.preventDefault();
        element.innerHTML = '';
        element.setAttribute('data-empty', '');
        update(current => current.map(item => item.id === id && 'text' in item ? { ...item, text: '' } : item));
        apply(id, items[Math.min(menu.index, items.length - 1)]!.type);
        return;
      }
    }

    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      // An empty list item ends the list.
      if (LIST_TYPES.has(block.type) && isEmptyHtml(element.innerHTML)) { setType(id, 'paragraph'); return; }
      const range = caretRange(element);
      let tail = '';
      if (range) {
        range.deleteContents();
        const rest = document.createRange();
        rest.selectNodeContents(element);
        rest.setStart(range.startContainer, range.startOffset);
        tail = htmlOf(rest.extractContents());
      }
      if (isEmptyHtml(tail)) tail = '';
      element.toggleAttribute('data-empty', isEmptyHtml(element.innerHTML));
      const head = element.innerHTML;
      const next: ArticleBlock = nextType(block.type) === 'todo' ? { id: newBlockId(), type: 'todo', text: tail, checked: false } : { id: newBlockId(), type: nextType(block.type), text: tail };
      update(current => {
        const index = current.findIndex(item => item.id === id);
        const updated = current.map(item => item.id === id && 'text' in item ? { ...item, text: head } : item);
        return [...updated.slice(0, index + 1), next, ...updated.slice(index + 1)];
      });
      focus(next.id, 0);
      return;
    }

    if (event.key === 'Backspace' && caretAtStart(element)) {
      if (block.type !== 'paragraph') { event.preventDefault(); setType(id, 'paragraph'); return; }
      const previous = list[at - 1];
      if (!previous) return;
      event.preventDefault();
      if ('text' in previous) {
        const target = elements.current.get(previous.id);
        if (!target) return;
        const offset = (target.textContent ?? '').length;
        target.innerHTML = (isEmptyHtml(target.innerHTML) ? '' : target.innerHTML) + element.innerHTML;
        target.toggleAttribute('data-empty', isEmptyHtml(target.innerHTML));
        const merged = target.innerHTML;
        update(current => current.filter(item => item.id !== id).map(item => item.id === previous.id && 'text' in item ? { ...item, text: merged } : item));
        focus(previous.id, offset);
      } else if (isEmptyHtml(element.innerHTML)) remove(id);
      else focus(previous.id);
      return;
    }

    if (event.key === 'ArrowUp' && at > 0 && caretOnEdgeLine(element, 'top')) {
      const previous = list[at - 1]!;
      event.preventDefault();
      focus(previous.id, 'end');
      setActive(previous.id);
      setBlocks(current => [...current]);
      return;
    }
    if (event.key === 'ArrowDown' && at < list.length - 1 && caretOnEdgeLine(element, 'bottom')) {
      const following = list[at + 1]!;
      event.preventDefault();
      focus(following.id, 0);
      setActive(following.id);
      setBlocks(current => [...current]);
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && !window.getSelection()?.isCollapsed) {
      event.preventDefault();
      startLink.current();
    }
  }, [menu, apply, setType, update, focus, remove]);

  /** Pasted text arrives as plain text; several lines become several paragraphs. */
  const onPaste = useCallback((event: ClipboardEvent<HTMLDivElement>, id: string) => {
    const text = event.clipboardData.getData('text/plain');
    if (!text) return;
    event.preventDefault();
    const lines = text.replace(/\r\n?/g, '\n').split(/\n{1,}/).map(line => line.trim()).filter(Boolean);
    if (lines.length <= 1) { document.execCommand('insertText', false, text.replace(/\s+/g, ' ')); return; }
    document.execCommand('insertText', false, lines[0]!);
    const escape = (line: string) => line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const added: ArticleBlock[] = lines.slice(1).map(line => ({ id: newBlockId(), type: 'paragraph', text: escape(line) }));
    update(current => {
      const at = current.findIndex(block => block.id === id);
      return [...current.slice(0, at + 1), ...added, ...current.slice(at + 1)];
    });
    focus(added.at(-1)!.id, 'end');
  }, [update, focus]);

  const onFocus = useCallback((id: string) => setActive(id), []);

  // ——— photos ———
  async function upload(file: File) {
    const target = uploadTarget.current;
    uploadTarget.current = null;
    if (!target) return;
    setUploading(target);
    try {
      const id = doc.current.id ?? await save();
      if (!id) return;
      const form = new FormData();
      form.set('photo', file);
      const result = await uploadArticleImageAction(id, form);
      if (result.error || !result.id) { setState(current => ({ ...current, error: result.error ?? 'Не удалось загрузить фото.' })); return; }
      if (target === 'cover') { setCoverId(result.id); touch(); return; }
      const image: ArticleBlock = { id: newBlockId(), type: 'image', imageId: result.id, caption: '' };
      const element = elements.current.get(target);
      const block = blocksRef.current.find(item => item.id === target);
      if (block && 'text' in block && (!element || isEmptyHtml(element.innerHTML))) update(current => current.map(item => item.id === target ? image : item));
      else insertAfter(target, image);
      const paragraph: ArticleBlock = { id: newBlockId(), type: 'paragraph', text: '' };
      insertAfter(image.id, paragraph);
      focus(paragraph.id, 0);
    } finally { setUploading(null); }
  }

  // ——— the format bar over a selection ———
  const [bar, setBar] = useState<{ top: number; left: number } | null>(null);
  const [palette, setPalette] = useState(false);
  const [linking, setLinking] = useState(false);
  const [linkValue, setLinkValue] = useState('');
  const savedRange = useRef<Range | null>(null);
  useEffect(() => {
    function place() {
      if (linking) return;
      setPalette(false);
      const selection = window.getSelection();
      if (!selection?.rangeCount || selection.isCollapsed) { setBar(null); return; }
      const range = selection.getRangeAt(0);
      const host = (range.commonAncestorContainer instanceof Element ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement)?.closest('.ae-text');
      if (!host) { setBar(null); return; }
      const rect = range.getBoundingClientRect();
      const coarse = window.matchMedia('(pointer: coarse)').matches;
      setBar({ top: coarse ? rect.bottom + 10 : rect.top - 50, left: Math.min(Math.max(8, rect.left + rect.width / 2 - 130), window.innerWidth - 268) });
    }
    document.addEventListener('selectionchange', place);
    return () => document.removeEventListener('selectionchange', place);
  }, [linking]);
  /** Paints the selection; «Обычный» writes a colour the sanitizer drops, so the text goes back to the default. */
  function paint(color: TextColor | null) {
    document.execCommand('styleWithCSS', false, 'false');
    document.execCommand('foreColor', false, color ? TEXT_COLORS[color].hex : '#000001');
    setPalette(false);
  }
  function format(command: 'bold' | 'italic' | 'strikeThrough' | 'code') {
    if (command === 'code') {
      const text = window.getSelection()?.toString() ?? '';
      document.execCommand('insertHTML', false, `<code>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</code>`);
    } else document.execCommand(command);
  }
  const startLink = useRef(() => {
    const selection = window.getSelection();
    savedRange.current = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
    setLinkValue('');
    setLinking(true);
  });
  function finishLink(apply: boolean) {
    const range = savedRange.current;
    setLinking(false); setBar(null);
    if (!apply || !range) return;
    const value = linkValue.trim();
    const href = safeHref(/^[a-z0-9-]+\.[a-z]{2,}/i.test(value) ? `https://${value}` : value);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    if (href) document.execCommand('createLink', false, href); else if (!value) document.execCommand('unlink');
  }

  // ——— drag and drop by the handle ———
  function dropTo(id: string, after: boolean) {
    const from = drag?.id;
    setDrag(null);
    if (!from || from === id) return;
    update(current => {
      const moving = current.find(block => block.id === from);
      if (!moving) return current;
      const rest = current.filter(block => block.id !== from);
      const at = rest.findIndex(block => block.id === id);
      rest.splice(after ? at + 1 : at, 0, moving);
      return rest;
    });
  }

  async function removeDraft() {
    const id = doc.current.id;
    if (!id || !window.confirm('Удалить черновик? Вернуть его не получится.')) return;
    const result = await deleteDraftAction(id);
    if (result.error) { setSubmitError(result.error); return; }
    setState(current => ({ ...current, dirty: false, saving: false }));
    router.push('/news');
  }

  // ——— submit ———
  async function submit() {
    setSubmitError('');
    const problem = articleReadiness(title, snapshot());
    if (problem) { setSubmitError(problem); return; }
    setSubmitting(true);
    try {
      const id = await save();
      if (!id) return;
      const result = await submitArticleAction(id);
      if (result.error) { setSubmitError(result.error); return; }
      router.push(`/news/${id}?sent=1`);
    } finally { setSubmitting(false); }
  }

  const drinks = useMemo(() => new Map(options.map(option => [JSON.stringify([option.brand, option.flavor]), option])), [options]);
  const numbers = useMemo(() => {
    const out: number[] = [];
    for (const block of blocks) out.push(block.type === 'numbered' ? (out.at(-1) ?? 0) + 1 : 0);
    return out;
  }, [blocks]);
  const status = state.error ? 'Не сохранено' : state.saving ? 'Сохраняем…' : state.dirty ? 'Есть правки' : state.savedAt || initial.id ? 'Сохранено' : 'Черновик';

  return <div className="article-editor">
    <div className="ae-topbar">
      <Link className="ae-back" href="/news" aria-label="К новостям">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg>
      </Link>
      <span className="ae-status" role="status" data-error={state.error ? '' : undefined}>{status}</span>
      {articleId && <button type="button" className="ae-delete" aria-label="Удалить черновик" title="Удалить черновик" onClick={removeDraft}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>
      </button>}
      <button type="button" className="community-button ae-submit" disabled={submitting || state.saving} onClick={submit}>{submitting ? 'Публикуем…' : 'Опубликовать'}</button>
    </div>
    {initial.moderationNote && <FormAlert tone="warning" title="Статью вернули на доработку">{initial.moderationNote}</FormAlert>}
    {state.error && <FormAlert>{state.error}</FormAlert>}
    {submitError && <FormAlert>{submitError}</FormAlert>}

    <div className="ae-cover">
      {coverId ? <figure>
        {/* eslint-disable-next-line @next/next/no-img-element -- the author's own upload, served from the database */}
        <img src={`/api/article-images/${coverId}`} alt="" />
        <div className="ae-cover-actions">
          <button type="button" onClick={() => { uploadTarget.current = 'cover'; fileInput.current?.click(); }}>Сменить</button>
          <button type="button" onClick={() => { setCoverId(null); touch(); }}>Убрать</button>
        </div>
      </figure> : <button type="button" className="ae-add-cover" disabled={uploading === 'cover'} onClick={() => { uploadTarget.current = 'cover'; fileInput.current?.click(); }}>
        {uploading === 'cover' ? 'Загружаем…' : '🖼 Добавить обложку'}
      </button>}
    </div>

    <textarea ref={titleRef} className="ae-title" rows={1} maxLength={ARTICLE_TITLE_MAX} placeholder="Без названия" aria-label="Заголовок статьи" value={title}
      onChange={event => { setTitle(event.target.value.replace(/\n/g, ' ')); touch(); event.target.style.height = 'auto'; event.target.style.height = `${event.target.scrollHeight}px`; }}
      onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); const first = blocksRef.current[0]; if (first) focus(first.id, 0); setBlocks(current => [...current]); } }} />

    <div className="ae-blocks" data-single={blocks.length === 1 || undefined} onDragOver={event => { if (drag) event.preventDefault(); }}>
      {blocks.map((block, index) => {
        const over = drag?.over === block.id ? (drag.after ? 'after' : 'before') : undefined;
        return <div key={block.id} className="ae-block" data-block-row={block.id} data-drop={over} data-active={active === block.id || undefined}
          tabIndex={isTextBlock(block.type) ? undefined : 0}
          onFocus={() => setActive(block.id)}
          onKeyDown={event => {
            if (isTextBlock(block.type) || event.target !== event.currentTarget) return;
            if (event.key === 'Backspace' || event.key === 'Delete') { event.preventDefault(); remove(block.id); }
            if (event.key === 'Enter') { event.preventDefault(); const paragraph: ArticleBlock = { id: newBlockId(), type: 'paragraph', text: '' }; insertAfter(block.id, paragraph); focus(paragraph.id, 0); }
          }}
          onDragOver={event => {
            if (!drag) return;
            event.preventDefault();
            const box = event.currentTarget.getBoundingClientRect();
            const after = event.clientY > box.top + box.height / 2;
            if (drag.over !== block.id || drag.after !== after) setDrag({ ...drag, over: block.id, after });
          }}
          onDrop={event => { event.preventDefault(); if (drag) dropTo(block.id, drag.after); }}>
          <div className="ae-gutter">
            <button type="button" className="ae-gutter-button" aria-label="Добавить блок ниже" onClick={() => {
              const paragraph: ArticleBlock = { id: newBlockId(), type: 'paragraph', text: '' };
              insertAfter(block.id, paragraph); focus(paragraph.id, 0); setMenu({ id: paragraph.id, query: '', index: 0 });
            }}>+</button>
            <button type="button" className="ae-gutter-button ae-handle" aria-label="Перетащить или открыть меню блока" aria-haspopup="menu" draggable
              onDragStart={event => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', block.id); setDrag({ id: block.id, over: null, after: false }); setMenu(null); setBlockMenu(null); }}
              onDragEnd={() => setDrag(null)}
              onClick={() => setBlockMenu(current => current === block.id ? null : block.id)}>⋮⋮</button>
          </div>

          <div className="ae-block-body">
            {'text' in block ? (picking === block.id ? <div className="ae-drink-picker">
              <StoreDrinkPicker id={`drink-${block.id}`} options={options} taken={NOTHING_TAKEN} placeholder="Найдите напиток в каталоге"
                onAdd={chosen => {
                  setPicking(null);
                  if (!chosen.brand || !chosen.flavor) return;
                  const drink: ArticleBlock = { id: newBlockId(), type: 'drink', brand: chosen.brand, flavor: chosen.flavor };
                  const element = elements.current.get(block.id);
                  if (!element || isEmptyHtml(element.innerHTML)) update(current => current.map(item => item.id === block.id ? drink : item));
                  else insertAfter(block.id, drink);
                  focus(drink.id);
                }} />
              <button type="button" className="community-button community-button-text" onClick={() => { setPicking(null); focus(block.id); }}>Отмена</button>
            </div> : <EditableText block={block} number={numbers[index]!} first={index === 0} register={register} onInput={onInput} onKeyDown={onKeyDown} onPaste={onPaste} onFocus={onFocus} onToggle={onToggle} />)
              : block.type === 'divider' ? <hr className="ae-divider" />
              : block.type === 'image' ? <figure className="ae-image">
                {/* eslint-disable-next-line @next/next/no-img-element -- the author's own upload, served from the database */}
                <img src={`/api/article-images/${block.imageId}`} alt={block.caption} />
                <input className="ae-caption" placeholder="Подпись к фото" maxLength={200} value={block.caption} aria-label="Подпись к фото"
                  onChange={event => update(current => current.map(item => item.id === block.id && item.type === 'image' ? { ...item, caption: event.target.value } : item))} />
              </figure>
              : (() => {
                const option = drinks.get(JSON.stringify([block.brand, block.flavor]));
                return <div className="ae-drink">
                  {option?.cover ? <Image src={option.cover} width={48} height={48} alt="" unoptimized={option.cover.startsWith('/')} /> : <span className="ae-drink-bolt" aria-hidden="true">⚡</span>}
                  <span><small>Напиток из каталога</small><strong>{option?.label ?? `${block.brand} · ${block.flavor}`}</strong></span>
                </div>;
              })()}
            {uploading === block.id && <p className="ae-uploading">Загружаем фото…</p>}

            {menu?.id === block.id && <SlashMenu query={menu.query} index={menu.index} onPick={type => {
              const element = elements.current.get(block.id);
              if (element) { element.innerHTML = ''; element.setAttribute('data-empty', ''); }
              update(current => current.map(item => item.id === block.id && 'text' in item ? { ...item, text: '' } : item));
              apply(block.id, type);
            }} onHover={next => setMenu({ ...menu, index: next })} />}

            {blockMenu === block.id && <div className="ae-menu ae-block-menu" role="menu">
              {'text' in block && <p className="ae-menu-title">Превратить в</p>}
              {'text' in block && BLOCK_MENU.filter(item => isTextBlock(item.type)).map(item => <button key={item.type} type="button" role="menuitem" data-current={item.type === block.type || undefined}
                onClick={() => { setType(block.id, item.type as TextBlockType); setBlockMenu(null); focus(block.id); }}><span className="ae-menu-icon">{ICONS[item.type]}</span>{item.label}</button>)}
              <p className="ae-menu-title">Действия</p>
              <button type="button" role="menuitem" onClick={() => { duplicate(block.id); setBlockMenu(null); }}><span className="ae-menu-icon">⧉</span>Дублировать</button>
              <button type="button" role="menuitem" disabled={index === 0} onClick={() => { move(block.id, -1); setBlockMenu(null); }}><span className="ae-menu-icon">↑</span>Выше</button>
              <button type="button" role="menuitem" disabled={index === blocks.length - 1} onClick={() => { move(block.id, 1); setBlockMenu(null); }}><span className="ae-menu-icon">↓</span>Ниже</button>
              <button type="button" role="menuitem" className="is-danger" onClick={() => { remove(block.id); setBlockMenu(null); }}><span className="ae-menu-icon">🗑</span>Удалить</button>
            </div>}
          </div>
        </div>;
      })}
      <button type="button" className="ae-append" onClick={() => {
        const last = blocksRef.current.at(-1);
        if (last && 'text' in last && isEmptyHtml(elements.current.get(last.id)?.innerHTML ?? last.text)) { focus(last.id, 0); setBlocks(current => [...current]); return; }
        const paragraph: ArticleBlock = { id: newBlockId(), type: 'paragraph', text: '' };
        insertAfter(null, paragraph); focus(paragraph.id, 0);
      }}>+ Новый блок</button>
    </div>

    {/* The author's Telegram channel under the article, as «Канал автора» on reviews. */}
    <div className="ae-channel">
      {channelOpen ? <>
        <label htmlFor="article-channel">Канал автора</label>
        <div className="ae-channel-row">
          <span className="ae-channel-field"><span aria-hidden="true">t.me/</span>
            <input id="article-channel" value={channel} maxLength={64} placeholder="energyhub" autoComplete="off" spellCheck={false} aria-invalid={!channelValid}
              onChange={event => { setChannel(bareChannel(event.target.value)); touch(); }} />
          </span>
          <button type="button" className="ae-channel-remove" aria-label="Убрать канал" onClick={() => { setChannel(''); setChannelOpen(false); touch(); }}>×</button>
        </div>
        {!channelValid && <p className="field-error">Имя канала — от 5 до 32 латинских букв, цифр и «_».</p>}
      </> : <div className="ae-channel-offer">
        <button type="button" className="ae-channel-add" onClick={() => setChannelOpen(true)}>
          <Image src="/brand/icons/telegram.svg" width={18} height={18} alt="" />Прикрепить Telegram-канал
        </button>
        {profileChannel && <button type="button" className="ae-channel-own" onClick={() => { setChannel(profileChannel); setChannelOpen(true); touch(); }}>свой @{profileChannel}</button>}
      </div>}
    </div>

    {/* Phones: no hover gutter, so the focused block gets a toolbar over the tab bar. */}
    {active && <div className="ae-touchbar" role="toolbar" aria-label="Блок">
      <button type="button" onMouseDown={event => event.preventDefault()} onClick={() => {
        const paragraph: ArticleBlock = { id: newBlockId(), type: 'paragraph', text: '' };
        insertAfter(active, paragraph); focus(paragraph.id, 0); setMenu({ id: paragraph.id, query: '', index: 0 });
      }}>＋ Блок</button>
      <button type="button" onMouseDown={event => event.preventDefault()} onClick={() => setBlockMenu(current => current === active ? null : active)}>Тип</button>
      <button type="button" aria-label="Выше" onMouseDown={event => event.preventDefault()} onClick={() => move(active, -1)}>↑</button>
      <button type="button" aria-label="Ниже" onMouseDown={event => event.preventDefault()} onClick={() => move(active, 1)}>↓</button>
    </div>}

    {bar && <div className="ae-format" style={{ top: bar.top, left: bar.left }} role="toolbar" aria-label="Форматирование" onMouseDown={event => { if (!(event.target instanceof HTMLInputElement)) event.preventDefault(); }}>
      {linking ? <form className="ae-link-form" onSubmit={event => { event.preventDefault(); finishLink(true); }}>
        <input autoFocus value={linkValue} placeholder="https://… или /catalog/…" aria-label="Ссылка" onChange={event => setLinkValue(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') finishLink(false); }} />
        <button type="submit">OK</button>
      </form> : <>
        <button type="button" aria-label="Жирный" onClick={() => format('bold')}><b>Ж</b></button>
        <button type="button" aria-label="Курсив" onClick={() => format('italic')}><i>К</i></button>
        <button type="button" aria-label="Зачёркнутый" onClick={() => format('strikeThrough')}><s>З</s></button>
        <button type="button" aria-label="Код" onClick={() => format('code')}><code>{'<>'}</code></button>
        <button type="button" aria-label="Ссылка" onClick={() => startLink.current()}>🔗</button>
        <button type="button" aria-label="Цвет текста" aria-expanded={palette} onClick={() => setPalette(open => !open)}><span className="ae-color-glyph">А</span></button>
        {palette && <div className="ae-palette" role="menu" aria-label="Цвет текста">
          <button type="button" role="menuitem" onClick={() => paint(null)}><span className="ae-swatch" data-color="default" />Обычный</button>
          {(Object.keys(TEXT_COLORS) as TextColor[]).map(color => <button key={color} type="button" role="menuitem" onClick={() => paint(color)}>
            <span className="ae-swatch" data-color={color} />{TEXT_COLORS[color].label}
          </button>)}
        </div>}
      </>}
    </div>}

    <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void upload(file); else uploadTarget.current = null; }} />
  </div>;
}

function SlashMenu({ query, index, onPick, onHover }: { query: string; index: number; onPick: (type: ArticleBlockType) => void; onHover: (index: number) => void }) {
  const items = filterMenu(query);
  return <div className="ae-menu ae-slash" role="listbox" aria-label="Блоки">
    <p className="ae-menu-title">{items.length ? 'Блоки' : 'Ничего не найдено'}</p>
    {items.map((item, at) => <button key={item.type} type="button" role="option" aria-selected={at === index} onMouseDown={event => event.preventDefault()} onMouseEnter={() => onHover(at)} onClick={() => onPick(item.type)}>
      <span className="ae-menu-icon">{ICONS[item.type]}</span><span><strong>{item.label}</strong><small>{item.hint}{item.markdown ? ` · ${item.markdown}` : ''}</small></span>
    </button>)}
  </div>;
}
