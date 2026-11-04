'use client';
import Image from 'next/image';
import Link from '@/components/navigation-progress';
import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { AvatarFrame } from '@/components/avatar-frame';
import { LevelChip } from '@/components/level-badge';
import type { BrandFrameProgress } from '@/lib/brand-frame-fields';
import { pluralRu } from '@/lib/drink-calendar-fields';
import { experienceForLevel } from '@/lib/experience-level';
import { ACHIEVEMENT_RARITIES, achievementImage, PROFILE_ACHIEVEMENTS } from '@/lib/profile-achievements';
import { BRAND_FRAME_ITEMS, BRAND_FRAME_REVIEWS, isLevelCosmetic, nextAppearanceUnlock, PROFILE_FRAMES, PROFILE_THEMES, type ProfileAppearance } from '@/lib/profile-appearance';
import { useAnchoredPopover } from '@/lib/use-anchored-popover';

export type LookImageKind = 'avatar' | 'banner';
/** A picture of the profile as the editor holds it: the shown source and whether it differs from the saved one. */
export type LookImage = { src: string | null; changed: boolean; removed: boolean };
/** The tile whose list opens by itself: old links to the removed sections (`?section=appearance|tags`). */
export type LookTileKey = 'frame' | 'theme' | 'tag';

const ICON = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;
const PlusIcon = () => <svg {...ICON} width={24} height={24}><path d="M12 5v14M5 12h14" /></svg>;
const Check = () => <svg {...ICON} className="look-option-check"><path d="m5 12.5 4.5 4.5L19 7.5" strokeWidth="2" /></svg>;
const UploadIcon = () => <svg {...ICON}><path d="M12 15V4" /><path d="m7 9 5-5 5 5" /><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></svg>;
const CropIcon = () => <svg {...ICON}><path d="M6 2v14a2 2 0 0 0 2 2h14" /><path d="M18 22V8a2 2 0 0 0-2-2H2" /></svg>;
const TrashIcon = () => <svg {...ICON}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>;
const UndoIcon = () => <svg {...ICON}><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>;
const PencilIcon = () => <svg {...ICON} width={16} height={16}><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></svg>;
const BlocksIcon = () => <svg {...ICON} width={28} height={28}><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg>;

function ThemeSwatch({ theme }: { theme: string }) {
  return <span className="appearance-swatch" data-profile-theme={theme} aria-hidden="true"><i /><i /><i /><i /></span>;
}
function FrameSample({ frame, avatarSrc }: { frame: string; avatarSrc: string | null }) {
  return <span className="appearance-frame-sample community-avatar" data-frame={frame} aria-hidden="true">
    {/* eslint-disable-next-line @next/next/no-img-element -- the member's own avatar, also a fresh upload preview */}
    {avatarSrc ? <img src={avatarSrc} alt="" loading="lazy" /> : 'C'}<AvatarFrame frame={frame as ProfileAppearance['frame']} />
  </span>;
}
const Copy = ({ title, note }: { title: ReactNode; note?: ReactNode }) => <span className="look-option-copy"><strong>{title}</strong>{note && <span>{note}</span>}</span>;

/** Arrows, Home and End move between the options of an open list. */
function moveFocus(event: KeyboardEvent<HTMLDivElement>) {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  const options = [...event.currentTarget.querySelectorAll<HTMLElement>('.look-option:not(:disabled)')];
  if (!options.length) return;
  const index = options.indexOf(document.activeElement as HTMLElement);
  const target = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : index + (event.key === 'ArrowDown' ? 1 : -1);
  options[(target + options.length) % options.length]?.focus();
  event.preventDefault();
}

/**
 * One tile of the strip: a picture of the current choice, a caption and the value. It opens its list right under itself
 * (a `popover` in the top layer); the list is themed like the preview it sits in.
 */
function LookTile({ name, label, value, art, empty, changed, autoOpen, disabled, children }: {
  name: string; label: string; value: string; art: ReactNode; empty?: boolean; changed?: boolean; autoOpen?: boolean; disabled?: boolean;
  children: (close: () => void) => ReactNode;
}) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const { trigger, position, place } = useAnchoredPopover<HTMLButtonElement>(open, 460, 320);
  // By id, not by ref: the lists get `close` while rendering, and a ref must not be read there.
  const close = () => { document.getElementById(id)?.hidePopover(); document.getElementById(`${id}-tile`)?.focus({ preventScroll: true }); };
  useEffect(() => {
    if (!autoOpen) return;
    const frame = requestAnimationFrame(() => { trigger.current?.scrollIntoView({ block: 'center', inline: 'center' }); panel.current?.showPopover(); });
    return () => cancelAnimationFrame(frame);
  }, [autoOpen, trigger]);
  return <div className="look-tile-wrap" data-look={name}>
    <button ref={trigger} id={`${id}-tile`} type="button" className="look-tile" popoverTarget={id} aria-expanded={open} aria-controls={id} data-open={open || undefined} data-empty={empty || undefined} disabled={disabled} onClick={place}>
      <span className="look-tile-art" aria-hidden="true">{empty ? <PlusIcon /> : art}</span>
      <span className="look-tile-label">{label}{changed && <span className="look-tile-dot" title="Изменено, не сохранено"><span className="sr-only">, изменено</span></span>}</span>
      <span className="look-tile-value">{value}</span>
    </button>
    <div ref={panel} id={id} popover="auto" className="look-menu" style={position} onKeyDown={moveFocus}
      onToggle={event => {
        const shown = event.newState === 'open';
        setOpen(shown);
        if (!shown) return;
        place();
        panel.current?.querySelector<HTMLElement>('.look-option[aria-checked=true]:not(:disabled), .look-option:not(:disabled)')?.focus({ preventScroll: true });
      }}>
      <p className="look-menu-title">{label}</p>
      {children(close)}
    </div>
  </div>;
}

/** What the next level opens, under the theme and frame lists. */
function NextUnlock({ level, xp }: { level: number; xp: number }) {
  const next = nextAppearanceUnlock(level);
  if (!next) return <p className="look-menu-note">За уровни вам открыто всё оформление.</p>;
  const gap = Math.max(0, experienceForLevel(next.level) - xp);
  const what = new Intl.ListFormat('ru', { type: 'conjunction' }).format([...next.themes.map(label => `фон «${label}»`), ...next.frames.map(label => `рамку «${label}»`)]);
  return <p className="look-menu-note"><LevelChip level={next.level} /> откроет {what} — ещё {gap.toLocaleString('ru-RU')} XP. Опыт дают отзывы, тирлисты и магазины.</p>;
}

function ImageMenu({ kind, image, disabled, close, onPick, onCrop, onRemove, onUndo }: {
  kind: LookImageKind; image: LookImage; disabled: boolean; close: () => void;
  onPick: (kind: LookImageKind, file: File) => void; onCrop: (kind: LookImageKind) => void; onRemove: (kind: LookImageKind) => void; onUndo: (kind: LookImageKind) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const noun = kind === 'avatar' ? 'аватар' : 'баннер';
  return <>
    <ul className="look-options">
      {/* The file input is clicked from the item in the same tap: a label would not take the list's focus and arrows. */}
      <li><button type="button" className="look-option" disabled={disabled} onClick={() => input.current?.click()}><span className="look-option-icon"><UploadIcon /></span><Copy title={image.src ? 'Загрузить другое фото' : 'Загрузить фото'} /></button>
        <input ref={input} type="file" hidden accept="image/jpeg,image/png,image/webp,image/gif" aria-label={`Загрузить ${noun}`}
          onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; close(); onPick(kind, file); }} /></li>
      {image.src && <li><button type="button" className="look-option" disabled={disabled} onClick={() => { close(); onCrop(kind); }}><span className="look-option-icon"><CropIcon /></span><Copy title="Изменить кадр" /></button></li>}
      {image.src && <li><button type="button" className="look-option is-danger" disabled={disabled} onClick={() => { onRemove(kind); close(); }}><span className="look-option-icon"><TrashIcon /></span><Copy title={`Удалить ${noun}`} /></button></li>}
      {image.changed && <li><button type="button" className="look-option" disabled={disabled} onClick={() => { onUndo(kind); close(); }}><span className="look-option-icon"><UndoIcon /></span><Copy title="Вернуть как было" /></button></li>}
    </ul>
    <p className="look-menu-note">JPG, PNG или WebP до 5 МБ, GIF до 10 МБ — он станет лёгкой анимацией. {kind === 'avatar' ? 'Аватар обрезается квадратом.' : 'Баннер — полоса 4:1.'}</p>
  </>;
}

/**
 * The pencil on the preview's avatar or banner once there is a picture: a list to upload another one, recrop, remove or
 * undo. Without a picture the pencil stays part of the drop target and opens the file picker at once.
 */
export function ProfileImageMenu({ kind, image, disabled, onPick, onCrop, onRemove, onUndo }: {
  kind: LookImageKind; image: LookImage; disabled: boolean;
  onPick: (kind: LookImageKind, file: File) => void; onCrop: (kind: LookImageKind) => void; onRemove: (kind: LookImageKind) => void; onUndo: (kind: LookImageKind) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const { trigger, position, place } = useAnchoredPopover<HTMLButtonElement>(open, 400, 280);
  const close = () => { document.getElementById(id)?.hidePopover(); document.getElementById(`${id}-button`)?.focus({ preventScroll: true }); };
  const title = kind === 'avatar' ? 'Аватар' : 'Баннер';
  return <>
    <button ref={trigger} id={`${id}-button`} type="button" className={`profile-edit-menu profile-edit-menu-${kind}`} popoverTarget={id} aria-expanded={open} aria-controls={id}
      aria-label={kind === 'avatar' ? 'Изменить аватар' : 'Изменить баннер'} disabled={disabled} onClick={place}>
      <span className="profile-edit-badge" aria-hidden="true"><PencilIcon /></span>
    </button>
    <div id={id} popover="auto" className="look-menu" style={position} onKeyDown={moveFocus}
      onToggle={event => {
        const shown = event.newState === 'open';
        setOpen(shown);
        if (!shown) return;
        place();
        event.currentTarget.querySelector<HTMLElement>('.look-option:not(:disabled)')?.focus({ preventScroll: true });
      }}>
      <p className="look-menu-title">{title}</p>
      <ImageMenu kind={kind} image={image} disabled={disabled} close={close} onPick={onPick} onCrop={onCrop} onRemove={onRemove} onUndo={onUndo} />
    </div>
  </>;
}

/**
 * How the profile looks, right on its preview in settings: one row of tiles across the preview (frame, background,
 * tag, blocks), each opening its list in place. Avatar and banner change by the pencil on the preview itself. Choices
 * change the preview at once and are saved with the profile's «Сохранить»; blocks open their own editor (order and
 * visibility need room).
 */
export function ProfileLookStrip({ appearance, saved, onAppearance, level, xp, owned, brandFrames, avatarSrc, tag, blocks, disabled, autoOpen }: {
  appearance: ProfileAppearance; saved: ProfileAppearance; onAppearance: (value: ProfileAppearance) => void;
  level: number; xp: number; owned: readonly string[]; brandFrames: readonly BrandFrameProgress[];
  /** The avatar shown in the frame samples. */
  avatarSrc: string | null;
  tag?: { value: string; saved: string; earned: readonly string[]; onChange: (key: string) => void; href: string };
  blocks: { shown: number; total: number; open: () => void };
  disabled: boolean; autoOpen?: LookTileKey | null;
}) {
  const theme = PROFILE_THEMES.find(item => item.key === appearance.theme) ?? PROFILE_THEMES[0]!;
  const frame = PROFILE_FRAMES.find(item => item.key === appearance.frame) ?? PROFILE_FRAMES[0]!;

  // A frame is usable when the level opens it, it is owned (gacha, brand reviews) or already worn.
  const usableFrame = (item: typeof PROFILE_FRAMES[number]) => item.level <= level || item.key === saved.frame || owned.includes(item.key);
  const frames = PROFILE_FRAMES.filter(usableFrame);
  const lockedBrands = BRAND_FRAME_ITEMS.filter(item => !usableFrame(item));
  const lockedFrames = PROFILE_FRAMES.filter(item => isLevelCosmetic(item) && !usableFrame(item));
  const reviewed = new Map(brandFrames.map(item => [item.key as string, item.reviewed]));
  const usableTheme = (item: typeof PROFILE_THEMES[number]) => item.level <= level || item.key === saved.theme;
  const tags = tag ? PROFILE_ACHIEVEMENTS.filter(item => tag.earned.includes(item.key)) : [];
  const currentTag = tags.find(item => item.key === tag?.value);
  const locked = (required: number) => { const gap = required - level; return <span className="look-option-lock"><LevelChip level={required} /><small>ещё {gap} {pluralRu(gap, 'уровень', 'уровня', 'уровней')}</small></span>; };

  return <div className="look-strip" role="group" aria-label="Внешний вид профиля">
    <LookTile name="frame" label="Рамка" autoOpen={autoOpen === 'frame'} disabled={disabled} empty={appearance.frame === 'none'} changed={appearance.frame !== saved.frame}
      value={frame.label} art={<FrameSample frame={appearance.frame} avatarSrc={avatarSrc} />}>
      {close => <>
        <div role="radiogroup" aria-label="Рамка аватарки">
          <ul className="look-options">{frames.map(item => <li key={item.key}>
            <button type="button" role="radio" aria-checked={item.key === appearance.frame} className="look-option" onClick={() => { onAppearance({ ...appearance, frame: item.key }); close(); }}>
              <FrameSample frame={item.key} avatarSrc={avatarSrc} />
              <Copy title={item.label} note={'special' in item ? `Эксклюзив · ${item.special}` : (item as { description?: string }).description} />
              {item.key === appearance.frame && <Check />}
            </button>
          </li>)}</ul>
          {lockedBrands.length > 0 && <>
            <p className="look-group">Рамки брендов · оцените {BRAND_FRAME_REVIEWS} разных вкусов</p>
            <ul className="look-options">{lockedBrands.map(item => {
              const count = Math.min(reviewed.get(item.key) ?? 0, BRAND_FRAME_REVIEWS);
              return <li key={item.key}><Link className="look-option look-option-brand" href={`/catalog?brand=${encodeURIComponent(item.brand)}`}>
                <FrameSample frame={item.key} avatarSrc={avatarSrc} />
                <span className="look-option-copy"><strong>{item.label}</strong><span>Оцените {BRAND_FRAME_REVIEWS} разных вкусов {item.brand}</span>
                  <span className="look-meter" role="progressbar" aria-valuemin={0} aria-valuemax={BRAND_FRAME_REVIEWS} aria-valuenow={count} aria-label={`Отзывы на вкусы ${item.brand}`}><i style={{ '--value': count / BRAND_FRAME_REVIEWS } as CSSProperties} /></span></span>
                <span className="look-option-count">{count} / {BRAND_FRAME_REVIEWS}</span>
              </Link></li>;
            })}</ul>
          </>}
          {lockedFrames.length > 0 && <>
            <p className="look-group">Откроются с уровнем</p>
            <ul className="look-options">{lockedFrames.map(item => <li key={item.key}>
              <button type="button" role="radio" aria-checked={false} disabled className="look-option"><FrameSample frame={item.key} avatarSrc={avatarSrc} /><Copy title={item.label} />{locked(item.level)}</button>
            </li>)}</ul>
          </>}
        </div>
        <NextUnlock level={level} xp={xp} />
      </>}
    </LookTile>
    <LookTile name="theme" label="Фон" autoOpen={autoOpen === 'theme'} disabled={disabled} changed={appearance.theme !== saved.theme} value={theme.label} art={<ThemeSwatch theme={theme.key} />}>
      {close => <>
        <div role="radiogroup" aria-label="Фон профиля">
          <ul className="look-options">{PROFILE_THEMES.filter(usableTheme).map(item => <li key={item.key}>
            <button type="button" role="radio" aria-checked={item.key === appearance.theme} className="look-option" onClick={() => { onAppearance({ ...appearance, theme: item.key }); close(); }}>
              <ThemeSwatch theme={item.key} /><Copy title={item.label} note={item.description} />{item.key === appearance.theme && <Check />}
            </button>
          </li>)}</ul>
          {PROFILE_THEMES.some(item => !usableTheme(item)) && <>
            <p className="look-group">Откроются с уровнем</p>
            <ul className="look-options">{PROFILE_THEMES.filter(item => !usableTheme(item)).map(item => <li key={item.key}>
              <button type="button" role="radio" aria-checked={false} disabled className="look-option"><ThemeSwatch theme={item.key} /><Copy title={item.label} note={item.description} />{locked(item.level)}</button>
            </li>)}</ul>
          </>}
        </div>
        <NextUnlock level={level} xp={xp} />
      </>}
    </LookTile>
    {tag && <LookTile name="tag" label="Тег" autoOpen={autoOpen === 'tag'} disabled={disabled} empty={!currentTag} changed={tag.value !== tag.saved}
      value={currentTag?.label ?? 'Без тега'} art={currentTag && <Image className="look-art-tag" src={achievementImage(currentTag.key)} width={52} height={52} alt="" />}>
      {close => <>
        <div role="radiogroup" aria-label="Тег рядом с именем">
          <ul className="look-options">
            <li><button type="button" role="radio" aria-checked={!currentTag} className="look-option" onClick={() => { tag.onChange(''); close(); }}>
              <span className="look-option-icon look-option-none" aria-hidden="true">—</span><Copy title="Без тега" note="Только имя и уровень" />{!currentTag && <Check />}
            </button></li>
            {tags.map(item => <li key={item.key}><button type="button" role="radio" aria-checked={item.key === tag.value} className="look-option" data-rarity={item.rarity} onClick={() => { tag.onChange(item.key); close(); }}>
              <Image className="look-option-art" src={achievementImage(item.key)} width={44} height={44} alt="" />
              <Copy title={<span className="profile-tag" data-tag={item.key}>{item.label}</span>} note={`${ACHIEVEMENT_RARITIES[item.rarity]} · ${item.description}`} />
              {item.key === tag.value && <Check />}
            </button></li>)}
          </ul>
        </div>
        <p className="look-menu-note">{tags.length ? 'Тег стоит рядом с именем в профиле, отзывах и тирлистах.' : 'Пока нет тегов: их дают достижения.'} <Link href={tag.href}>Все достижения и условия</Link></p>
      </>}
    </LookTile>}
    <div className="look-tile-wrap" data-look="blocks">
      <button type="button" className="look-tile" disabled={disabled} onClick={blocks.open}>
        <span className="look-tile-art" aria-hidden="true"><BlocksIcon /></span>
        <span className="look-tile-label">Блоки</span>
        <span className="look-tile-value">{blocks.shown} из {blocks.total}</span>
      </button>
    </div>
  </div>;
}
