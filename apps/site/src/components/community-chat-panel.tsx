'use client';

import '@/styles/shared.css';
import '@/styles/profile.css';
import '@/styles/chat.css';
import Image from 'next/image';
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useTransition, type KeyboardEvent, type MouseEvent } from 'react';
import { deleteChatMessageAction, leaveChatAction, loadChatAction, olderChatAction, reactChatAction, sendChatAction } from '@/app/chat/actions';
import { ActionToast } from '@/components/action-toast';
import { TrashIcon } from '@/components/action-icons';
import { AttachMenu } from '@/components/attach-menu';
import { AvatarFrame } from '@/components/avatar-frame';
import { BottomSheet, BottomSheetHead } from '@/components/bottom-sheet';
import { ChatBubblesIcon } from '@/components/chat-bubbles-icon';
import { ContentReportButton } from '@/components/content-report-button';
import { LevelChip } from '@/components/level-badge';
import { MediaAttachmentPreviews, useMediaAttachments } from '@/components/media-attachments';
import { MentionText } from '@/components/mention-text';
import { MentionTextarea } from '@/components/mention-textarea';
import { MoreActions } from '@/components/more-actions';
import Link from '@/components/navigation-progress';
import { ProfileTag } from '@/components/profile-tag';
import { ReviewPhotoGallery } from '@/components/review-photo-gallery';
import { SignInPrompt } from '@/components/sign-in-prompt';
import { StaffDeleteMenuItem } from '@/components/staff-delete-button';
import { VerifiedMark } from '@/components/verified-mark';
import { useWallDrink, WallDrinkChip } from '@/components/wall-drink';
import { WallDrinkCard } from '@/components/wall-drink-card';
import type { ChatAuthor, ChatMessage, ChatPresence, ChatViewer } from '@/lib/community-chat';
import {
  CHAT_EMOJI, CHAT_POLL_MS, CHAT_REACTIONS, CHAT_TEXT_LIMIT, chatDayLabel, groupChatMessages, mergeChatPage, prependChatPage, quoteSnippet,
  toggleReaction, type ChatReactionEmoji,
} from '@/lib/community-chat-fields';

type Held = { items: ChatMessage[]; authors: Record<string, ChatAuthor>; hasMore: boolean; viewer: ChatViewer | null; presence: ChatPresence };
/**
 * What the panel showed last: the button lives in the page's navigation, so it mounts again on every page — the next
 * opening starts from these messages instead of an empty panel and refreshes them.
 */
let held: Held | null = null;

type Toast = { message: string; tone: 'success' | 'error' };
type Replying = { id: string; name: string; text: string };
const NO_PRESENCE: ChatPresence = { count: 0, people: [] };
const NO_TOAST = {};
const TIME = { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit' } as const;
const clock = (iso: string) => new Date(iso).toLocaleTimeString('ru-RU', TIME);
const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
const authorName = (author: ChatAuthor | undefined) => author?.username ?? (author?.name && !author.name.includes('@') ? author.name : 'Участник');
const finePointer = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

function Icon({ d, size = 20 }: { d: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
}
const REPLY = 'M10 8 4 13l6 5M4 13h9a7 7 0 0 1 7 7';
const SMILE = 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01';
const COPY = 'M9 9h10v12H9zM5 15V3h10';
const SEND = 'M12 19V5M5 12l7-7 7 7';

/**
 * The community chat's panel: a sheet over the page — the right side of the screen on a computer, the whole screen on a
 * phone. Messages poll every few seconds while it is open and the tab visible, «Показать предыдущие» keeps the line
 * being read in place, a reply's quote leads to the original. Built on the site's pieces: avatar frames, level chip,
 * tag and check mark of the author, MentionText, the wall's attachments and drink card, MoreActions with a report.
 */
export default function CommunityChatPanel({ open, focus, signedIn, onClose }: { open: boolean; focus: { id: string } | null; signedIn: boolean; onClose: () => void }) {
  const sheet = useRef<HTMLDialogElement | null>(null);
  const [dialog, setDialog] = useState<HTMLDialogElement | null>(null);
  const titleId = useId();
  const [items, setItems] = useState<ChatMessage[]>(held?.items ?? []);
  const [authors, setAuthors] = useState<Record<string, ChatAuthor>>(held?.authors ?? {});
  const [hasMore, setHasMore] = useState(held?.hasMore ?? false);
  const [viewer, setViewer] = useState<ChatViewer | null>(held?.viewer ?? null);
  const [presence, setPresence] = useState<ChatPresence>(held?.presence ?? NO_PRESENCE);
  const [loaded, setLoaded] = useState(Boolean(held));
  const [connection, setConnection] = useState('');
  const [olderBusy, setOlderBusy] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [picker, setPicker] = useState<string | null>(null);
  const [replying, setReplying] = useState<Replying | null>(null);
  const [fresh, setFresh] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const body = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const busy = useRef(false);
  const stick = useRef(true);
  const anchor = useRef<number | null>(null);
  const itemsRef = useRef(items);
  const hasMoreRef = useRef(hasMore);
  const loadedRef = useRef(loaded);
  const focusRef = useRef(focus);
  useEffect(() => {
    itemsRef.current = items; hasMoreRef.current = hasMore; loadedRef.current = loaded;
    held = { items, authors, hasMore, viewer, presence };
  });

  const setSheet = useCallback((node: HTMLDialogElement | null) => { sheet.current = node; setDialog(node); }, []);
  const showError = useCallback((message: string) => setToast({ message, tone: 'error' }), []);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const result = await loadChatAction();
      if ('error' in result) { setConnection(result.error); return; }
      setConnection('');
      setViewer(result.viewer);
      setPresence(result.presence);
      setAuthors(previous => ({ ...previous, ...result.authors }));
      const before = itemsRef.current;
      const merged = mergeChatPage(before, result.items, result.hasMore);
      if (merged.reset || !loadedRef.current || !before.length) setHasMore(result.hasMore);
      const last = merged.items.at(-1);
      if (loadedRef.current && last && last.id !== before.at(-1)?.id && !stick.current && last.userId !== result.viewer?.id) setFresh(true);
      itemsRef.current = merged.items;
      setItems(merged.items);
      setLoaded(true);
    } catch { setConnection('Нет соединения. Сообщения обновятся, когда связь вернётся.'); }
    finally { busy.current = false; }
  }, []);

  // Open and close follow the button; while open, the newest page is asked for every few seconds.
  useEffect(() => {
    const node = sheet.current;
    if (!node) return;
    if (open && !node.open) {
      stick.current = true;
      node.showModal();
      if (body.current) body.current.scrollTop = body.current.scrollHeight;
      if (finePointer()) node.querySelector<HTMLTextAreaElement>('.chat-compose textarea')?.focus({ preventScroll: true });
    } else if (!open && node.open) node.close();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const first = setTimeout(() => { void refresh(); }, 0);
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, CHAT_POLL_MS);
    const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', visible);
    return () => { clearTimeout(first); clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, [open, refresh]);

  // A phone keyboard shrinks the visual viewport, not the layout one: the sheet follows it, so the field stays in sight.
  useEffect(() => {
    const viewport = window.visualViewport, node = sheet.current;
    if (!open || !viewport || !node) return;
    const sync = () => { node.style.setProperty('--chat-vh', `${viewport.height}px`); node.style.setProperty('--chat-top', `${viewport.offsetTop}px`); };
    sync();
    viewport.addEventListener('resize', sync); viewport.addEventListener('scroll', sync);
    return () => { viewport.removeEventListener('resize', sync); viewport.removeEventListener('scroll', sync); };
  }, [open]);

  // The list opens on the newest message and follows new ones while the reader is at the bottom (photos loading later
  // grow it too); loading older messages keeps the line being read in place.
  useLayoutEffect(() => {
    const element = body.current;
    if (!element) return;
    if (anchor.current !== null) { element.scrollTop = element.scrollHeight - anchor.current; anchor.current = null; }
    else if (stick.current) element.scrollTop = element.scrollHeight;
  }, [items]);
  useEffect(() => {
    const element = body.current, content = list.current;
    if (!element || !content) return;
    const observer = new ResizeObserver(() => { if (stick.current && anchor.current === null) element.scrollTop = element.scrollHeight; });
    observer.observe(content); observer.observe(element);
    return () => observer.disconnect();
  }, [loaded]);

  const older = useCallback(async (): Promise<boolean> => {
    const first = itemsRef.current[0];
    if (!first) return false;
    if (body.current) anchor.current = body.current.scrollHeight - body.current.scrollTop;
    setOlderBusy(true);
    try {
      const result = await olderChatAction({ id: first.id, createdAt: first.createdAt });
      if ('error' in result) { anchor.current = null; showError(result.error); return false; }
      hasMoreRef.current = result.hasMore;
      setHasMore(result.hasMore);
      setAuthors(previous => ({ ...result.authors, ...previous }));
      setItems(previous => prependChatPage(previous, result.items));
      return true;
    } catch { anchor.current = null; showError('Не удалось загрузить сообщения. Проверьте интернет и попробуйте ещё раз.'); return false; }
    finally { setOlderBusy(false); }
  }, [showError]);

  /** To a quoted message (or the one a notification points at): older pages load until it shows up. */
  const jumpTo = useCallback(async (id: string) => {
    for (let round = 0; round < 6; round += 1) {
      const element = body.current?.querySelector<HTMLElement>(`[data-message="${CSS.escape(id)}"]`);
      if (element) {
        stick.current = false;
        element.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        setFlash(id);
        window.setTimeout(() => setFlash(current => current === id ? null : current), 1800);
        return;
      }
      if (!hasMoreRef.current || !await older()) break;
      await nextFrame();
    }
    showError('Это сообщение удалено или слишком далеко в истории.');
  }, [older, showError]);
  // A notification's link: once the first page is in, go to its message.
  useEffect(() => {
    if (focus) focusRef.current = focus;
  }, [focus]);
  useEffect(() => {
    const target = focusRef.current;
    if (!open || !loaded || !target) return;
    focusRef.current = null;
    void nextFrame().then(() => jumpTo(target.id));
  }, [open, loaded, focus, jumpTo]);

  async function react(message: ChatMessage, emoji: ChatReactionEmoji) {
    setPicker(null);
    if (!viewer) { showError('Войдите, чтобы ставить реакции.'); return; }
    const apply = (reactions: ChatMessage['reactions']) => setItems(previous => previous.map(item => item.id === message.id ? { ...item, reactions } : item));
    apply(toggleReaction(message.reactions, emoji));
    const result = await reactChatAction(message.id, emoji).catch(() => ({ error: 'Реакция не сохранилась. Проверьте интернет и попробуйте ещё раз.', reactions: undefined }));
    if (result.reactions) apply(result.reactions);
    else { apply(message.reactions); if (result.error) showError(result.error); }
  }
  async function remove(message: ChatMessage) {
    if (!window.confirm('Удалить сообщение? Вернуть его будет нельзя.')) return;
    const result = await deleteChatMessageAction(message.id).catch(() => ({ error: 'Не удалось удалить. Проверьте интернет и попробуйте ещё раз.' }));
    if (result.error) { showError(result.error); return; }
    setItems(previous => previous.filter(item => item.id !== message.id));
    setToast({ message: 'Сообщение удалено', tone: 'success' });
  }
  function reply(message: ChatMessage) {
    setReplying({ id: message.id, name: authorName(authors[message.userId]), text: message.text ? quoteSnippet(message.text, 70) : 'Вложение' });
    setActive(null);
    window.requestAnimationFrame(() => sheet.current?.querySelector<HTMLTextAreaElement>('.chat-compose textarea')?.focus());
  }

  const groups = useMemo(() => groupChatMessages(items), [items]);
  const canWrite = Boolean(viewer && viewer.username && !viewer.blocked && !viewer.frozen);

  return <BottomSheet ref={setSheet} className="chat-sheet" labelledBy={titleId} onClose={() => { setPicker(null); setActive(null); void leaveChatAction(); onClose(); }}>
    <BottomSheetHead id={titleId} onClose={() => sheet.current?.close()}
      title={<span className="chat-title"><span className="chat-title-icon" aria-hidden="true"><ChatBubblesIcon size={20} /></span>
        <span className="chat-title-text">Чат сообщества<small data-live={presence.count > 0 || undefined}>{presence.count ? `${presence.count} в чате` : 'Общий чат CanRush'}</small></span></span>}
      actions={presence.people.length ? <ChatPresenceAvatars presence={presence} /> : undefined} />
    <div ref={body} className="chat-body" data-no-pull onScroll={event => {
      const element = event.currentTarget;
      stick.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
      if (stick.current && fresh) setFresh(false);
    }}>
      {connection && <p className="chat-connection" role="status">{connection} <button type="button" onClick={() => void refresh()}>Обновить</button></p>}
      {hasMore && <button type="button" className="chat-older" disabled={olderBusy} onClick={() => void older()}>{olderBusy ? 'Загружаем…' : 'Показать предыдущие'}</button>}
      {!loaded ? <p className="chat-loading" role="status"><span className="chat-spinner" aria-hidden="true" />Загружаем чат…</p>
        : items.length ? <ol ref={list} className="chat-list" aria-label="Сообщения чата">{groups.map(group => {
          const author = authors[group.userId];
          return [
            group.newDay ? <li key={`day-${group.key}`} className="chat-day"><span>{chatDayLabel(group.messages[0]!.createdAt)}</span></li> : null,
            <li key={group.key} className="chat-group" data-own={group.userId === viewer?.id || undefined}>
              <ChatAvatar author={author} />
              <div className="chat-group-body">
                <p className="chat-author">
                  {author?.username ? <Link className="chat-name" href={`/profile/${author.username}`}>{author.username}</Link> : <span className="chat-name">{authorName(author)}</span>}
                  {author?.verified && <VerifiedMark />}
                  {author?.tag && <ProfileTag tag={author.tag.key}>{author.tag.label}</ProfileTag>}
                  <time dateTime={group.messages[0]!.createdAt}>{clock(group.messages[0]!.createdAt)}</time>
                </p>
                {group.messages.map(message => <ChatMessageView key={message.id} message={message} viewer={viewer} canWrite={canWrite}
                  active={active === message.id} picking={picker === message.id} flashing={flash === message.id}
                  onSelect={() => setActive(current => current === message.id ? null : message.id)}
                  onPick={() => setPicker(current => current === message.id ? null : message.id)}
                  onReact={emoji => void react(message, emoji)} onReply={() => reply(message)} onDelete={() => void remove(message)}
                  onStaffDeleted={() => setItems(previous => previous.filter(item => item.id !== message.id))}
                  onJump={id => void jumpTo(id)} onCopied={ok => setToast(ok ? { message: 'Текст скопирован', tone: 'success' } : { message: 'Не удалось скопировать. Выделите текст вручную.', tone: 'error' })} />)}
              </div>
            </li>,
          ];
        })}</ol>
        : <div className="chat-empty"><span className="chat-empty-icon" aria-hidden="true"><ChatBubblesIcon size={30} /></span><strong>Здесь пока тихо</strong><p>Напишите первым: поздоровайтесь или спросите, какой энергетик попробовать.</p></div>}
      {fresh && <button type="button" className="chat-fresh" onClick={() => {
        stick.current = true; setFresh(false);
        if (body.current) body.current.scrollTop = body.current.scrollHeight;
      }}>Новые сообщения <Icon d="M12 5v14M5 12l7 7 7-7" size={16} /></button>}
    </div>
    <div className="chat-foot">
      {canWrite ? <ChatComposer replying={replying} onCancelReply={() => setReplying(null)} onError={showError}
        onSent={() => { setReplying(null); stick.current = true; setFresh(false); void refresh(); }} />
        : !viewer ? (loaded || !signedIn ? <SignInPrompt compact title="Войдите, чтобы писать в чат" text="Отвечать, ставить реакции и упоминать участников можно после входа." /> : null)
            : viewer.blocked ? <p className="chat-notice">Писать в чат этому аккаунту нельзя.</p>
              : viewer.frozen ? <p className="chat-notice">{viewer.frozen}</p>
                : <div className="chat-notice"><p>Чтобы писать в чат, придумайте ник — по нему вас узнают и упоминают.</p>
                  <Link className="chat-notice-button" href="/profile/settings?section=details">Придумать ник</Link></div>}
    </div>
    <ActionToast message={toast?.message} trigger={toast ?? NO_TOAST} tone={toast?.tone} container={dialog} />
  </BottomSheet>;
}

function ChatAvatar({ author }: { author: ChatAuthor | undefined }) {
  const frame = author?.frame ?? 'none';
  const face = author?.avatarId
    ? <Image src={`/api/profile-images/${author.avatarId}`} width={44} height={44} unoptimized alt="" />
    : <span>{authorName(author).charAt(0).toLocaleUpperCase('ru-RU')}</span>;
  const avatar = author?.username
    ? <Link className="wall-avatar chat-avatar" data-frame={frame} href={`/profile/${author.username}`} tabIndex={-1} aria-hidden="true">{face}{frame !== 'none' && <AvatarFrame frame={frame} />}</Link>
    : <span className="wall-avatar chat-avatar" data-frame={frame} aria-hidden="true">{face}{frame !== 'none' && <AvatarFrame frame={frame} />}</span>;
  return <div className="chat-avatar-column">{avatar}{author && <LevelChip level={author.level} />}</div>;
}

function ChatPresenceAvatars({ presence }: { presence: ChatPresence }) {
  const more = presence.count - presence.people.length;
  return <span className="chat-presence" role="img" aria-label={`Сейчас в чате: ${presence.count}`}>
    {presence.people.map(person => <span key={person.id} className="chat-presence-face" title={`@${person.username}`}>
      {person.avatarId ? <Image src={`/api/profile-images/${person.avatarId}`} width={30} height={30} unoptimized alt="" /> : person.username.charAt(0).toUpperCase()}
    </span>)}
    {more > 0 && <span className="chat-presence-face chat-presence-more">+{more}</span>}
  </span>;
}

function ChatMessageView({ message, viewer, canWrite, active, picking, flashing, onSelect, onPick, onReact, onReply, onDelete, onStaffDeleted, onJump, onCopied }: {
  message: ChatMessage; viewer: ChatViewer | null; canWrite: boolean; active: boolean; picking: boolean; flashing: boolean;
  onSelect: () => void; onPick: () => void; onReact: (emoji: ChatReactionEmoji) => void; onReply: () => void; onDelete: () => void;
  onStaffDeleted: () => void; onJump: (id: string) => void; onCopied: (ok: boolean) => void;
}) {
  const own = message.userId === viewer?.id;
  const quote = message.replyTo;
  // On a touch screen a tap on the message shows its actions; links, buttons and players inside keep their own taps.
  function select(event: MouseEvent<HTMLDivElement>) {
    if ((event.target as Element).closest('a, button, video, input, textarea, [role="menu"]')) return;
    onSelect();
  }
  // The «⋯» menu opens upwards for a message in the lower half of the list, so the list's edge never cuts it.
  function place(event: { currentTarget: HTMLDivElement }) {
    const element = event.currentTarget, box = element.closest('.chat-body')?.getBoundingClientRect();
    if (box) element.dataset.up = element.getBoundingClientRect().top - box.top > box.height / 2 ? 'true' : 'false';
  }
  return <div className="chat-message" data-message={message.id} data-active={active || undefined} data-flash={flashing || undefined}
    onClick={select} onPointerEnter={place} onFocus={place}>
    {quote && <button type="button" className="chat-quote" disabled={quote.state !== 'shown' || !quote.id} onClick={() => quote.id && onJump(quote.id)}
      aria-label={quote.state === 'shown' ? `Ответ на сообщение ${quote.username ?? quote.name}: ${quoteSnippet(quote.text) || 'вложение'}. Перейти к нему` : undefined}>
      <b>{quote.username ?? quote.name}</b>
      <span>{quote.state === 'deleted' ? 'Сообщение удалено' : quote.state === 'hidden' ? 'Сообщение скрыто' : quoteSnippet(quote.text) || 'Вложение'}</span>
    </button>}
    <div className="chat-bubble" title={clock(message.createdAt)}>
      {message.text && <p className="chat-text"><MentionText text={message.text} /></p>}
      {message.media.length > 0 && <ReviewPhotoGallery photos={message.media.map(item => item.id)} kinds={message.media.map(item => item.kind)} source="chat-media" />}
      {message.drink && <WallDrinkCard drink={message.drink} compact />}
    </div>
    {message.reactions.length > 0 && <div className="chat-reactions">
      {message.reactions.map(reaction => <button key={reaction.emoji} type="button" className="chat-reaction" aria-pressed={reaction.mine} disabled={!viewer}
        aria-label={`${reaction.emoji} ${reaction.count}${reaction.mine ? ', ваша реакция — нажмите, чтобы убрать' : ''}`} onClick={() => onReact(reaction.emoji)}>
        <span aria-hidden="true">{reaction.emoji}</span>{reaction.count}
      </button>)}
    </div>}
    {picking && <div className="chat-react-row" role="group" aria-label="Реакция на сообщение"
      onKeyDown={(event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onPick(); } }}>
      {CHAT_REACTIONS.map(emoji => <button key={emoji} type="button" aria-label={`Реакция ${emoji}`} aria-pressed={message.reactions.some(item => item.emoji === emoji && item.mine)}
        onClick={() => onReact(emoji)}>{emoji}</button>)}
    </div>}
    <div className="chat-tools">
      {canWrite && <button type="button" className="chat-tool" aria-label="Ответить" title="Ответить" onClick={onReply}><Icon d={REPLY} size={18} /></button>}
      {viewer && <button type="button" className="chat-tool" aria-label="Поставить реакцию" title="Реакция" aria-expanded={picking} onClick={onPick}><Icon d={SMILE} size={18} /></button>}
      <MoreActions label="Действия с сообщением">
        {message.text && <button type="button" className="more-actions-item" role="menuitem" onClick={() => {
          if (!navigator.clipboard) { onCopied(false); return; }
          void navigator.clipboard.writeText(message.text).then(() => onCopied(true), () => onCopied(false));
        }}><Icon d={COPY} size={18} /><span>Скопировать текст</span></button>}
        {own && <button type="button" className="more-actions-item is-danger" role="menuitem" onClick={onDelete}><TrashIcon /><span>Удалить</span></button>}
        {!own && viewer && <ContentReportButton kind="chat-message" id={message.id} variant="menuitem" />}
        {!own && viewer?.staff && <StaffDeleteMenuItem kind="chat-message" id={message.id} onDeleted={onStaffDeleted} />}
      </MoreActions>
    </div>
  </div>;
}

function ChatComposer({ replying, onCancelReply, onSent, onError }: { replying: Replying | null; onCancelReply: () => void; onSent: () => void; onError: (message: string) => void }) {
  const [text, setText] = useState('');
  const [emoji, setEmoji] = useState(false);
  const [pending, start] = useTransition();
  const media = useMediaAttachments('сообщению');
  const drink = useWallDrink();
  const field = useRef<HTMLTextAreaElement | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const canSend = !pending && !media.preparing && Boolean(text.trim() || media.files.length || drink.drink);

  // The field grows with the text up to six lines, then scrolls.
  useLayoutEffect(() => {
    const node = field.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${Math.min(node.scrollHeight, 160)}px`;
  }, [text]);
  useEffect(() => {
    if (!emoji) return;
    const close = (event: PointerEvent) => { if (!(event.target as Element).closest('.chat-emoji, .chat-emoji-toggle')) setEmoji(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [emoji]);
  useEffect(() => { if (media.error) onError(media.error); }, [media.error, onError]);

  function insert(value: string) {
    const node = field.current;
    const from = node?.selectionStart ?? text.length, to = node?.selectionEnd ?? text.length;
    const next = text.slice(0, from) + value + text.slice(to);
    if (next.length > CHAT_TEXT_LIMIT) return;
    setText(next);
    const caret = from + value.length;
    window.requestAnimationFrame(() => { if (finePointer()) node?.focus(); node?.setSelectionRange(caret, caret); });
  }
  function send() {
    if (!canSend) return;
    const data = new FormData();
    data.set('text', text);
    if (replying) data.set('replyToId', replying.id);
    media.appendTo(data);
    drink.appendTo(data);
    setEmoji(false);
    start(async () => {
      try {
        const result = await sendChatAction(data);
        if (result.error) { onError(result.error); return; }
        setText(''); media.clear(); drink.clear(); onSent();
      } catch { onError('Сообщение не отправлено. Текст остался в поле — попробуйте ещё раз.'); }
    });
  }

  return <form ref={form} className="chat-compose" onSubmit={event => { event.preventDefault(); send(); }}
    onKeyDown={event => {
      if (event.key !== 'Escape') return;
      if (emoji) { event.preventDefault(); setEmoji(false); }
      else if (replying) { event.preventDefault(); onCancelReply(); }
    }}>
    {replying && <div className="chat-replying">
      <Icon d={REPLY} size={18} />
      <span><b>В ответ @{replying.name}</b><span>{replying.text}</span></span>
      <button type="button" onClick={onCancelReply} aria-label="Не отвечать"><Icon d="M6 6l12 12M18 6 6 18" size={16} /></button>
    </div>}
    <MediaAttachmentPreviews media={media} />
    <WallDrinkChip state={drink} />
    {emoji && <div className="chat-emoji" role="dialog" aria-label="Эмодзи">
      {CHAT_EMOJI.map(group => <section key={group.title}>
        <h3>{group.title}</h3>
        <div>{group.emoji.map(item => <button key={item} type="button" aria-label={item} onClick={() => insert(item)}>{item}</button>)}</div>
      </section>)}
    </div>}
    <div className="chat-compose-row">
      <button type="button" className="chat-icon-button chat-emoji-toggle" aria-label="Эмодзи" aria-expanded={emoji} onClick={() => setEmoji(value => !value)}><Icon d={SMILE} size={22} /></button>
      <AttachMenu media={media} drink={drink} label="Прикрепить фото, видео или энергетик" />
      <label className="chat-field"><span className="sr-only">Сообщение</span>
        <MentionTextarea ref={field} value={text} onValueChange={setText} maxLength={CHAT_TEXT_LIMIT} rows={1} placeholder="Написать сообщение…" readOnly={pending}
          onPaste={media.onPaste}
          onKeyDown={event => {
            if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
            if (event.metaKey || event.ctrlKey || finePointer()) { event.preventDefault(); send(); }
          }} />
      </label>
      <button type="submit" className="chat-send" aria-label={pending ? 'Отправляем' : 'Отправить'} disabled={!canSend}><Icon d={SEND} size={20} /></button>
    </div>
    {text.length > CHAT_TEXT_LIMIT - 200 && <p className="chat-count" aria-live="polite">{text.length} / {CHAT_TEXT_LIMIT}</p>}
  </form>;
}
