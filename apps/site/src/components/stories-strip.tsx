'use client';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { deleteStoryAction, publishStoryAction, viewStoriesAction } from '@/app/stories/actions';
import { ContentReportButton } from '@/components/content-report-button';
import { MoreActions } from '@/components/more-actions';
import Link from '@/components/navigation-progress';
import { useMediaAttachments } from '@/components/media-attachments';
import type { StoryRecommendation, WeeklyDigest } from '@/lib/story-digest';
import { nativeImage, nativeShare } from '@/lib/native-app';
import { pickReason } from '@/lib/pick-reason';
import { MAX_STORY_CAPTION } from '@/lib/story-limits';
import { renderWeekShare } from '@/lib/week-share-image';
import type { StoryAuthor, StoryItem } from '@/lib/stories';
import { WALL_MEDIA_ACCEPT } from '@/lib/wall-media-limits';

export type StorySlide =
  | { kind: 'media'; story: StoryItem }
  | { kind: 'digest'; digest: WeeklyDigest; page: DigestPage }
  | { kind: 'pick'; item: StoryRecommendation; basis: 'similar' | 'community' };
/** Slides of «Твоя неделя», in the order they play. */
export type DigestPage = 'empty' | 'intro' | 'cans' | 'drink' | 'progress' | 'discover' | 'summary';
export interface StoryGroupView { key: string; kind: 'user' | 'week' | 'picks'; title: string; author?: StoryAuthor; own?: boolean; seen?: boolean; slides: StorySlide[] }

/** A photo, GIF or a system card stays this long; a video plays to its end. */
const SLIDE_MS = 5000;
const SEEN_KEY = 'canrush:stories-seen';
const SEEN_EVENT = 'canrush:stories-seen';

/** Opened system stories (by key: week and day), kept per browser — they are built for the viewer, not stored. */
function seenSnapshot() { try { return localStorage.getItem(SEEN_KEY) ?? ''; } catch { return ''; } }
function subscribeSeen(notify: () => void) { window.addEventListener(SEEN_EVENT, notify); window.addEventListener('storage', notify); return () => { window.removeEventListener(SEEN_EVENT, notify); window.removeEventListener('storage', notify); }; }
function rememberSeen(key: string) {
  try {
    const keys = seenSnapshot().split('\n').filter(Boolean);
    if (keys.includes(key)) return;
    localStorage.setItem(SEEN_KEY, [...keys, key].slice(-20).join('\n'));
    window.dispatchEvent(new Event(SEEN_EVENT));
  } catch { /* storage unavailable: the ring just stays lit */ }
}

/** A picture: the app's share sheet, the system sheet with a file on phones, a PNG download elsewhere. */
async function shareImage(blob: Blob, fileName: string, title: string): Promise<'shared' | 'saved' | 'cancelled'> {
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
/** A link: the app's share sheet, the system sheet on touch screens, the clipboard on desktop. */
async function shareLink(url: string, title: string): Promise<'shared' | 'copied' | 'cancelled'> {
  const native = await nativeShare({ title, url, dialogTitle: title });
  if (native !== 'unavailable') return native;
  if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
    try { await navigator.share({ title, url }); return 'shared'; }
    catch (error) { if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'; }
  }
  await navigator.clipboard.writeText(url);
  return 'copied';
}

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
function dayLabel(day: string) { const [, month, date] = day.split('-').map(Number) as [number, number, number]; return { date, month: MONTHS[month - 1] ?? '' }; }
function weekLabel(digest: WeeklyDigest) {
  const from = dayLabel(digest.from), to = dayLabel(digest.to);
  return from.month === to.month ? `${from.date}–${to.date} ${to.month}` : `${from.date} ${from.month} — ${to.date} ${to.month}`;
}
function plural(value: number, one: string, few: string, many: string) {
  const tens = value % 100, ones = value % 10;
  if (tens >= 11 && tens <= 14) return many;
  return ones === 1 ? one : ones >= 2 && ones <= 4 ? few : many;
}
function ago(iso: string) {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  return minutes < 60 ? `${minutes} мин` : `${Math.round(minutes / 60)} ч`;
}

function Avatar({ group, size = 56 }: { group: StoryGroupView; size?: number }) {
  if (group.kind === 'week') return <span className="story-avatar story-avatar-week" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /><path d="m12.8 12-2.3 3.2h3l-2.3 3.3" /></svg></span>;
  if (group.kind === 'picks') return <span className="story-avatar story-avatar-picks" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3.5 14 9l5.5 2-5.5 2-2 5.5-2-5.5-5.5-2L10 9l2-5.5Z" /><path d="M19 3v3M17.5 4.5h3" /></svg></span>;
  const author = group.author!;
  return <span className="story-avatar" aria-hidden="true">{author.avatarId
    ? <Image src={`/api/profile-images/${author.avatarId}`} width={size} height={size} unoptimized alt="" />
    : <span>{author.username.slice(0, 1).toUpperCase()}</span>}</span>;
}

/**
 * Stories row on the home page: «add» for the signed-in member, their own stories, the weekly digest and picks,
 * then other members. A tap opens the full-screen viewer; the ring dims once everything in a group was seen.
 */
export function StoriesStrip({ groups, viewer, initial }: { groups: StoryGroupView[]; viewer: { username: string | null; avatarId: string | null } | null; initial?: { group: number; slide: number } }) {
  // A shared link (/?story=<id>) opens the viewer right on that story.
  const [open, setOpen] = useState<number | null>(initial?.group ?? null);
  const [openSlide, setOpenSlide] = useState(initial?.slide ?? 0);
  const [composer, setComposer] = useState(false);
  const [viewed, setViewed] = useState<Set<string>>(() => new Set());
  const seenKeys = useSyncExternalStore(subscribeSeen, seenSnapshot, () => '');
  const own = groups.find(group => group.own);
  // The own ring stays lit while a story is up, as a reminder that it is live.
  const isSeen = (group: StoryGroupView) => group.own ? false : group.kind === 'user'
    ? Boolean(group.seen) || group.slides.every(slide => slide.kind === 'media' && (slide.story.seen || viewed.has(slide.story.id)))
    : seenKeys.split('\n').includes(group.key);
  if (!groups.length && !viewer) return null;
  return <section className="stories" aria-label="Истории">
    <ul className="stories-row">
      {viewer && !own && <li><button type="button" className="story-chip" onClick={() => setComposer(true)}>
        <span className="story-ring is-add"><span className="story-avatar">{viewer.avatarId ? <Image src={`/api/profile-images/${viewer.avatarId}`} width={56} height={56} unoptimized alt="" /> : <span>{(viewer.username ?? '?').slice(0, 1).toUpperCase()}</span>}</span><span className="story-add-badge" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg></span></span>
        <span className="story-label">Добавить</span>
      </button></li>}
      {groups.map((group, index) => <li key={group.key} className={group.own ? 'is-own' : undefined}>
        <button type="button" className="story-chip" onClick={() => { setOpenSlide(0); setOpen(index); }} aria-label={group.own ? 'Ваши истории' : `${group.title}${isSeen(group) ? '' : ', новое'}`}>
          <span className={`story-ring${isSeen(group) ? ' is-seen' : ''}`} data-kind={group.kind}><Avatar group={group} /></span>
          <span className="story-label">{group.title}</span>
        </button>
        {group.own && <button type="button" className="story-add-badge is-button" aria-label="Добавить историю" onClick={() => setComposer(true)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg></button>}
      </li>)}
    </ul>
    {open !== null && <StoryViewer groups={groups} start={open} startSlide={openSlide} signedIn={Boolean(viewer)} onClose={() => setOpen(null)}
      onSeen={(group, slide) => {
        if (slide.kind === 'media') { if (!group.own) { setViewed(current => new Set(current).add(slide.story.id)); void viewStoriesAction([slide.story.id]); } }
        else rememberSeen(group.key);
      }} />}
    {composer && <StoryComposer onClose={() => setComposer(false)} />}
  </section>;
}

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
/** Weekday initials for the 7 days ending today (`from` may start on any weekday). */
function weekdays(from: string) {
  const start = (new Date(`${from}T12:00:00Z`).getUTCDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, index) => WEEKDAYS[(start + index) % 7]!);
}

/**
 * «Твоя неделя» in the spirit of Spotify Wrapped: one bold colour and one big idea per slide, shapes drifting
 * behind, lines rising in one after another (`--line` staggers them; reduced motion shows them at once).
 */
function DigestCard({ digest, page }: { digest: WeeklyDigest; page: DigestPage }) {
  const line = (index: number) => ({ '--line': index }) as CSSProperties;
  const shapes = <span className="wrap-shapes" aria-hidden="true"><i /><i /><i /></span>;
  if (page === 'empty') return <div className="wrap" data-page="empty">{shapes}
    <small style={line(0)}>Твоя неделя · {weekLabel(digest)}</small>
    <strong className="wrap-title" style={line(1)}>Тихая неделя</strong>
    <p style={line(2)}>Ни одной отметки за 7 дней. Отметь банку сегодня — и следующая сводка будет про тебя.</p>
    <Link className="story-card-cta" style={line(3)} href="/calendar">Отметить банку</Link>
  </div>;
  if (page === 'intro') return <div className="wrap" data-page="intro">{shapes}
    <small style={line(0)}>{weekLabel(digest)}</small>
    <strong className="wrap-title" style={line(1)}>Твоя неделя<br />в&nbsp;CanRush</strong>
    <p style={line(2)}>Банки, вкусы и опыт за последние 7 дней. Поехали ⚡</p>
  </div>;
  if (page === 'cans') {
    const max = Math.max(...digest.daily, 1);
    return <div className="wrap" data-page="cans">{shapes}
      <small style={line(0)}>Ты выпил</small>
      <strong className="wrap-number" style={line(1)}>{digest.cans}</strong>
      <p className="wrap-lead" style={line(2)}>{plural(digest.cans, 'банку', 'банки', 'банок')} за {digest.days} {plural(digest.days, 'день', 'дня', 'дней')} из 7</p>
      <ol className="wrap-week" style={line(3)} aria-label="Банки по дням">{digest.daily.map((count, index) => <li key={index} data-empty={count ? undefined : ''}>
        <span style={{ '--h': count / max } as CSSProperties}><b>{count || ''}</b></span><small>{weekdays(digest.from)[index]}</small>
      </li>)}</ol>
      {digest.ahead !== null && <p className="wrap-badge" style={line(4)}>Больше, чем у <b>{digest.ahead}%</b> участников</p>}
    </div>;
  }
  if (page === 'drink' && digest.favorite) return <div className="wrap" data-page="drink">{shapes}
    <small style={line(0)}>Твой вкус недели</small>
    {/* eslint-disable-next-line @next/next/no-img-element -- local catalog cover */}
    <span className="wrap-can" style={line(1)}>{digest.favorite.cover ? <img src={digest.favorite.cover} alt="" /> : <span aria-hidden="true">⚡</span>}</span>
    <strong className="wrap-title" style={line(2)}>{digest.favorite.name}</strong>
    <p className="wrap-lead" style={line(3)}>× {digest.favorite.count} {plural(digest.favorite.count, 'банка', 'банки', 'банок')} за неделю</p>
  </div>;
  if (page === 'progress') return <div className="wrap" data-page="progress">{shapes}
    <small style={line(0)}>Ты прокачался на</small>
    <strong className="wrap-number" style={line(1)}>+{digest.xp.toLocaleString('ru-RU')}<span>XP</span></strong>
    <ul className="wrap-facts">
      <li style={line(2)}><b>🔥 {digest.streak}</b>{plural(digest.streak, 'день', 'дня', 'дней')} серии</li>
      {digest.rank && <li style={line(3)}><b>№ {digest.rank}</b>в общем рейтинге</li>}
      <li style={line(4)}><b>{digest.reviews}</b>{plural(digest.reviews, 'отзыв', 'отзыва', 'отзывов')}</li>
    </ul>
  </div>;
  if (page === 'discover') return <div className="wrap" data-page="discover">{shapes}
    <small style={line(0)}>Открытия недели</small>
    <strong className="wrap-number" style={line(1)}>{digest.newDrinks}</strong>
    <p className="wrap-lead" style={line(2)}>{digest.newDrinks ? `${plural(digest.newDrinks, 'новый вкус', 'новых вкуса', 'новых вкусов')} — ты не боишься экспериментов` : 'Новых вкусов не было. Самое время рискнуть!'}</p>
    <Link className="story-card-cta" style={line(3)} href="/catalog">Найти новый вкус</Link>
  </div>;
  return <div className="wrap" data-page="summary">{shapes}
    <small style={line(0)}>Итоги · {weekLabel(digest)}</small>
    <strong className="wrap-title" style={line(1)}>Неделя в цифрах</strong>
    <dl className="wrap-summary" style={line(2)}>
      <div><dt>Банки</dt><dd>{digest.cans}</dd></div>
      <div><dt>Опыт</dt><dd>+{digest.xp.toLocaleString('ru-RU')}</dd></div>
      <div><dt>Серия</dt><dd>{digest.streak} дн.</dd></div>
      <div><dt>Новые вкусы</dt><dd>{digest.newDrinks}</dd></div>
      {digest.favorite && <div className="is-wide"><dt>Вкус недели</dt><dd>{digest.favorite.name}</dd></div>}
    </dl>
    <p className="wrap-sign" style={line(3)}>CanRush · увидимся через неделю</p>
  </div>;
}

function PickCard({ item, basis }: { item: StoryRecommendation; basis: 'similar' | 'community' }) {
  return <div className="story-card story-card-pick">
    <small>{basis === 'similar' ? 'Тебе понравится' : 'Популярно у сообщества'}</small>
    {/* eslint-disable-next-line @next/next/no-img-element -- local catalog cover */}
    <span className="story-pick-cover">{item.cover && <img src={item.cover} alt="" />}</span>
    <strong>{item.brand}</strong>
    <p>{item.name}</p>
    <p className="story-card-note">{pickReason(item.reason)}</p>
    <Link className="story-card-cta" href={item.href}>Открыть напиток</Link>
  </div>;
}

function StoryViewer({ groups, start, startSlide, signedIn, onClose, onSeen }: { groups: StoryGroupView[]; start: number; startSlide: number; signedIn: boolean; onClose: () => void; onSeen: (group: StoryGroupView, slide: StorySlide) => void }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [pos, setPos] = useState({ g: start, s: Math.min(startSlide, (groups[start]?.slides.length ?? 1) - 1) });
  const [notice, setNotice] = useState('');
  const [sharing, setSharing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const elapsed = useRef(0);
  const press = useRef<{ x: number; y: number; at: number; held: boolean; timer: number } | null>(null);
  const group = groups[pos.g]!;
  const slide = group.slides[pos.s]!;
  const isVideo = slide.kind === 'media' && slide.story.kind === 'video';

  function show(g: number, s: number) {
    const target = groups[g];
    const next = target?.slides[s];
    if (!target || !next) { onClose(); return; }
    elapsed.current = 0; setProgress(0); setPaused(false);
    setPos({ g, s });
    onSeen(target, next);
  }
  function go(step: 1 | -1) {
    if (step === 1) {
      if (pos.s + 1 < group.slides.length) show(pos.g, pos.s + 1);
      else show(pos.g + 1, 0);
    } else if (pos.s > 0) show(pos.g, pos.s - 1);
    else if (pos.g > 0) show(pos.g - 1, 0);
  }
  // The slide timer runs in an interval; it calls the latest `go` through this ref.
  const goRef = useRef(go);
  useEffect(() => { goRef.current = go; });

  useEffect(() => {
    const element = dialog.current;
    const overflow = document.body.style.overflow;
    element?.showModal(); document.body.style.overflow = 'hidden';
    return () => { element?.close(); document.body.style.overflow = overflow; };
  }, []);
  // The first slide counts as seen once the viewer opens.
  const opened = useRef(false);
  useEffect(() => { if (!opened.current) { opened.current = true; onSeen(groups[start]!, groups[start]!.slides[pos.s]!); } }, [groups, start, onSeen, pos.s]);
  useEffect(() => {
    if (paused || isVideo) return;
    const timer = window.setInterval(() => {
      elapsed.current += 50;
      if (elapsed.current >= SLIDE_MS) goRef.current(1);
      else setProgress(elapsed.current / SLIDE_MS);
    }, 50);
    return () => window.clearInterval(timer);
  }, [paused, isVideo, pos]);

  /** «Твоя неделя» goes as a picture, a pick and a member's story as links; the story waits while the sheet is open. */
  async function share() {
    if (sharing) return;
    setSharing(true); setPaused(true); video.current?.pause();
    try {
      let result: string;
      if (slide.kind === 'digest') result = await shareImage(await renderWeekShare(slide.digest), `canrush-week-${slide.digest.to}.png`, 'Моя неделя в CanRush');
      else if (slide.kind === 'pick') result = await shareLink(new URL(slide.item.href, window.location.origin).toString(), `${slide.item.brand} ${slide.item.name} — CanRush`);
      else result = await shareLink(new URL(`/?story=${slide.story.id}`, window.location.origin).toString(), `История @${group.author?.username ?? ''} в CanRush`);
      if (result !== 'cancelled') setNotice(result === 'copied' ? 'Ссылка скопирована' : result === 'saved' ? 'Картинка сохранена' : 'Отправлено');
    } catch { setNotice('Не удалось поделиться. Попробуйте ещё раз.'); }
    finally { setSharing(false); setPaused(false); void video.current?.play().catch(() => {}); }
  }
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(''), 2500); return () => window.clearTimeout(timer); }, [notice]);

  function onPointerDown(event: ReactPointerEvent) {
    if ((event.target as Element).closest('a, button, [role="menu"]')) return;
    const timer = window.setTimeout(() => { if (press.current) { press.current.held = true; setPaused(true); video.current?.pause(); } }, 220);
    press.current = { x: event.clientX, y: event.clientY, at: Date.now(), held: false, timer };
  }
  function onPointerUp(event: ReactPointerEvent) {
    const start = press.current; press.current = null;
    if (!start) return;
    window.clearTimeout(start.timer);
    if (start.held) { setPaused(false); void video.current?.play().catch(() => {}); return; }
    if (event.clientY - start.y > 90) { onClose(); return; }
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    go(event.clientX - box.left < box.width / 3 ? -1 : 1);
  }

  const title = group.own ? 'Ваша история' : group.title;
  return createPortal(<dialog ref={dialog} className="story-viewer" aria-label={`История: ${title}`} onCancel={event => { event.preventDefault(); onClose(); }}
    onKeyDown={event => { if (event.key === 'ArrowRight') go(1); if (event.key === 'ArrowLeft') go(-1); }}>
    <div className="story-frame" data-kind={slide.kind} data-tone={slide.kind === 'digest' && (slide.page === 'cans' || slide.page === 'discover') ? 'light' : undefined}>
      <div className="story-progress" aria-hidden="true">{group.slides.map((_, index) => <span key={index}><i style={{ transform: `scaleX(${index < pos.s ? 1 : index === pos.s ? progress : 0})` }} /></span>)}</div>
      <header className="story-head">
        {group.author && !group.own ? <Link className="story-head-author" href={`/profile/${group.author.username}`}><Avatar group={group} size={32} /><b>{title}</b></Link>
          : <span className="story-head-author"><Avatar group={group} size={32} /><b>{title}</b></span>}
        {slide.kind === 'media' && <time dateTime={slide.story.createdAt}>{ago(slide.story.createdAt)}</time>}
        <span className="story-head-actions">
          <button type="button" className="story-close story-share" aria-label={slide.kind === 'digest' ? 'Поделиться неделей картинкой' : 'Поделиться'} disabled={sharing} onClick={() => void share()}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5" /><path d="M5 12v6.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V12" /></svg>
          </button>
          {slide.kind === 'media' && (group.own
            ? <MoreActions label="Действия с историей"><button className="more-actions-item is-danger" type="button" role="menuitem" onClick={async () => {
                if (!window.confirm('Удалить эту историю?')) return;
                const result = await deleteStoryAction(slide.story.id);
                if (result.error) { window.alert(result.error); return; }
                onClose(); router.refresh();
              }}>Удалить историю</button></MoreActions>
            : signedIn && <MoreActions label="Действия с историей"><ContentReportButton kind="story" id={slide.story.id} variant="menuitem" /></MoreActions>)}
          <button type="button" className="story-close" aria-label="Закрыть истории" onClick={onClose}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
        </span>
      </header>
      <div className="story-stage" onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => { press.current = null; setPaused(false); }}>
        {slide.kind === 'media' && (slide.story.kind === 'video'
          ? <video key={slide.story.id} ref={video} src={`/api/story-media/${slide.story.id}`} poster={`/api/story-media/${slide.story.id}?size=thumbnail`} autoPlay playsInline
              onTimeUpdate={event => { const media = event.currentTarget; if (media.duration) setProgress(media.currentTime / media.duration); }} onEnded={() => go(1)} />
          /* eslint-disable-next-line @next/next/no-img-element -- stored story media, not optimised by Next */
          : <img key={slide.story.id} src={`/api/story-media/${slide.story.id}`} alt={slide.story.caption || `История ${title}`} draggable={false} />)}
        {slide.kind === 'media' && slide.story.caption && <p className="story-caption">{slide.story.caption}</p>}
        {slide.kind === 'digest' && <DigestCard digest={slide.digest} page={slide.page} />}
        {slide.kind === 'pick' && <PickCard item={slide.item} basis={slide.basis} />}
      </div>
      {notice && <p className="story-notice" role="status">{notice}</p>}
      <button type="button" className="story-nav" data-side="prev" aria-label="Предыдущая история" onClick={() => go(-1)} disabled={pos.g === 0 && pos.s === 0}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg></button>
      <button type="button" className="story-nav" data-side="next" aria-label="Следующая история" onClick={() => go(1)}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg></button>
    </div>
  </dialog>, document.body);
}

function StoryComposer({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const media = useMediaAttachments('истории');
  const [caption, setCaption] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const file = media.files[0];
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close(); }, []);
  async function publish() {
    if (!file) { setError('Выберите фото, GIF или видео.'); return; }
    setPending(true); setError('');
    const form = new FormData();
    media.appendTo(form);
    form.append('caption', caption);
    const result = await publishStoryAction(form);
    setPending(false);
    if (result.error) { setError(result.error); return; }
    media.clear(); onClose(); router.refresh();
  }
  return createPortal(<dialog ref={dialog} className="story-composer" aria-labelledby="story-composer-title" onCancel={event => { event.preventDefault(); if (!pending) onClose(); }}>
    <div className="story-composer-head"><h2 id="story-composer-title">Новая история</h2>
      <button type="button" className="story-close" aria-label="Закрыть" disabled={pending} onClick={onClose}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg></button></div>
    <label className={`story-composer-pick${file ? ' has-file' : ''}`}>
      {file ? (file.kind === 'video'
        ? <video src={file.url} muted playsInline autoPlay loop />
        /* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */
        : <img src={file.url} alt="Выбранное фото" />)
        : <span><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m3 17 5-5 4 4 3-3 6 6" /></svg>Фото, GIF или видео<small>Видео — до 20 МБ, история видна 24 часа</small></span>}
      <input type="file" accept={WALL_MEDIA_ACCEPT} disabled={pending || media.preparing} onChange={event => { const picked = Array.from(event.currentTarget.files ?? []).slice(0, 1); event.currentTarget.value = ''; media.clear(); void media.add(picked); }} />
    </label>
    <label className="story-composer-caption"><span className="sr-only">Подпись</span>
      <input value={caption} maxLength={MAX_STORY_CAPTION} placeholder="Подпись (необязательно)" onChange={event => setCaption(event.target.value)} disabled={pending} />
    </label>
    {(error || media.error) && <p className="field-error" role="alert">{error || media.error}</p>}
    <button type="button" className="community-button story-composer-submit" disabled={pending || media.preparing || !file} onClick={publish}>{pending ? 'Публикуем…' : 'Опубликовать'}</button>
  </dialog>, document.body);
}
