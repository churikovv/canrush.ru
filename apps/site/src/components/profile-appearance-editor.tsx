'use client';
import Link from 'next/link';
import { useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { AvatarFrame } from '@/components/avatar-frame';
import { LevelChip, LevelEmblem } from '@/components/level-badge';
import { ProfileStatFill } from '@/components/profile-stat-fill';
import { pluralRu } from '@/lib/drink-calendar-fields';
import { experienceForLevel, experienceLevel } from '@/lib/experience-level';
import { levelRank } from '@/lib/level-tier';
import type { BrandFrameProgress } from '@/lib/brand-frame-fields';
import { BRAND_FRAME_ITEMS, BRAND_FRAME_REVIEWS, DEFAULT_PROFILE_APPEARANCE, isLevelCosmetic, nextAppearanceUnlock, PROFILE_FRAMES, PROFILE_THEMES, type ProfileAppearance } from '@/lib/profile-appearance';
import { useAnchoredPopover } from '@/lib/use-anchored-popover';

type Choice<K extends string> = { key: K; level: number; label: string; description?: string; special?: string; brand?: string };

export function ProfileAppearanceEditor({ value, onChange, disabled, level, xp, current, owned = [], brandFrames = [], avatarSrc }: { level: number; xp?: number; current: ProfileAppearance; value: ProfileAppearance; onChange: (value: ProfileAppearance) => void; disabled: boolean; owned?: readonly string[]; brandFrames?: readonly BrandFrameProgress[]; avatarSrc?: string | null }) {
  return <section className="profile-appearance-editor" aria-labelledby="appearance-title">
    <div className="community-section-heading"><h2 id="appearance-title">Оформление</h2><button type="button" className="community-button community-button-secondary" disabled={disabled} onClick={() => onChange(DEFAULT_PROFILE_APPEARANCE)}>Сбросить оформление</button></div>
    <p className="community-section-note">Цвет и рамка видны всем посетителям. Шапка сверху показывает ваш выбор до сохранения.</p>
    <div className="appearance-islands">
      <AppearanceLevel level={level} xp={xp ?? experienceForLevel(level)} />
      <AppearancePicker title="Цвет профиля" items={PROFILE_THEMES} value={value.theme} saved={current.theme} level={level} disabled={disabled}
        preview={key => <ThemePreview theme={key} />} onChange={theme => onChange({ ...value, theme })} />
      <AppearancePicker title="Рамка аватарки" items={PROFILE_FRAMES} value={value.frame} saved={current.frame} level={level} owned={owned} disabled={disabled}
        preview={key => <span className="appearance-frame-sample community-avatar" data-frame={key} aria-hidden="true">C<AvatarFrame frame={key} /></span>}
        onChange={frame => onChange({ ...value, frame })} note="Анимация рамок отключается, если на устройстве включено уменьшение движения." />
      <BrandFrameGallery progress={brandFrames} value={value.frame} saved={current.frame} avatarSrc={avatarSrc} disabled={disabled} onChange={frame => onChange({ ...value, frame })} />
    </div>
  </section>;
}

function AppearanceLevel({ level, xp }: { level: number; xp: number }) {
  const progress = experienceLevel(xp);
  const rank = levelRank(level);
  const next = nextAppearanceUnlock(level);
  const opened = (items: readonly { level: number }[]) => items.filter(item => item.level <= level).length;
  const remaining = next ? Math.max(0, experienceForLevel(next.level) - progress.total) : 0;
  const unlocks = next && new Intl.ListFormat('ru', { type: 'conjunction' }).format([...next.themes.map(label => `тему «${label}»`), ...next.frames.map(label => `рамку «${label}»`)]);
  return <section className="appearance-island appearance-level" aria-labelledby="appearance-level-title" data-level-tier={rank.tier.key}>
    <LevelEmblem level={level} />
    <div className="appearance-level-body">
      <h3 id="appearance-level-title"><span>{rank.label}</span> Уровень {level}</h3>
      <div className="experience-track" data-level-tier={rank.tier.key} role="progressbar" aria-valuemin={0} aria-valuemax={progress.required} aria-valuenow={progress.current} aria-label={`Прогресс до уровня ${level + 1}`}>
        <ProfileStatFill value={progress.current / progress.required} />
      </div>
      <p className="appearance-level-xp">{progress.current.toLocaleString('ru-RU')} из {progress.required.toLocaleString('ru-RU')} XP до уровня {level + 1}</p>
    </div>
    <div className="appearance-level-next">
      {next && unlocks ? <>
        <p><LevelChip level={next.level} /> откроет {unlocks}</p>
        <p className="appearance-level-gap">Ещё {remaining.toLocaleString('ru-RU')} XP · отзывы, банки в трекере и тирлисты приносят опыт</p>
      </> : <p>Вам открыто всё оформление.</p>}
      <p className="appearance-level-count">Темы {opened(PROFILE_THEMES)} из {PROFILE_THEMES.length} · Рамки {opened(PROFILE_FRAMES.filter(isLevelCosmetic))} из {PROFILE_FRAMES.filter(isLevelCosmetic).length}</p>
    </div>
  </section>;
}

/** Brand frames as collectible cards: the frame on a dark stage, how to open it and how far the member is. */
function BrandFrameGallery({ progress, value, saved, avatarSrc, disabled, onChange }: {
  progress: readonly BrandFrameProgress[]; value: string; saved: string; avatarSrc?: string | null; disabled: boolean; onChange: (frame: ProfileAppearance['frame']) => void;
}) {
  const reviewed = new Map(progress.map(item => [item.key, item.reviewed]));
  const open = (key: string) => (reviewed.get(key as BrandFrameProgress['key']) ?? 0) >= BRAND_FRAME_REVIEWS || key === saved;
  const opened = BRAND_FRAME_ITEMS.filter(item => open(item.key)).length;
  return <section className="appearance-island brand-frames" aria-labelledby="brand-frames-title">
    <div className="appearance-island-heading">
      <h3 id="brand-frames-title">Рамки брендов</h3>
      <span>Открыто {opened} из {BRAND_FRAME_ITEMS.length}</span>
    </div>
    <p className="brand-frames-note">Оцените {BRAND_FRAME_REVIEWS} разных вкусов бренда — и его рамка откроется. Считаются ваши отзывы в каталоге.</p>
    <ul className="brand-frames-grid">
      {BRAND_FRAME_ITEMS.map(item => {
        const count = Math.min(reviewed.get(item.key) ?? 0, BRAND_FRAME_REVIEWS), isOpen = open(item.key), selected = item.key === value;
        return <li key={item.key} className="brand-frame-card" data-frame={item.key} data-open={isOpen || undefined} data-selected={selected || undefined}>
          <div className="brand-frame-stage">
            <span className="brand-frame-avatar community-avatar" data-frame={item.key} aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element -- the member's own avatar, also a fresh upload preview */}
              {avatarSrc ? <img src={avatarSrc} alt="" loading="lazy" /> : 'C'}<AvatarFrame frame={item.key} />
            </span>
            <span className="brand-frame-rarity">Легендарная</span>
          </div>
          <div className="brand-frame-body">
            <strong>{item.label}</strong>
            <span className="brand-frame-motif">{item.description}</span>
            {isOpen ? <button type="button" className="brand-frame-wear" aria-pressed={selected} disabled={disabled || selected} onClick={() => onChange(item.key)}>{selected ? 'Выбрана' : 'Надеть'}</button>
              : <div className="brand-frame-how">
                <span className="brand-frame-how-title"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0V4ZM8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3M12 13v4M8.5 20h7M10 17h4v3h-4z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>Как открыть</span>
                <Link href={`/catalog?brand=${encodeURIComponent(item.brand)}`}>Оцените {BRAND_FRAME_REVIEWS} разных вкусов {item.brand}</Link>
                <span className="brand-frame-meter" role="progressbar" aria-valuemin={0} aria-valuemax={BRAND_FRAME_REVIEWS} aria-valuenow={count} aria-label={`Отзывы на вкусы ${item.brand}`}>
                  <i style={{ '--value': count / BRAND_FRAME_REVIEWS } as CSSProperties} />
                </span>
                <span className="brand-frame-count">{count} / {BRAND_FRAME_REVIEWS}</span>
              </div>}
          </div>
        </li>;
      })}
    </ul>
  </section>;
}

function ThemePreview({ theme }: { theme: string }) {
  return <span className="appearance-swatch" data-profile-theme={theme} aria-hidden="true"><i /><i /><i /><i /></span>;
}

function AppearancePicker<K extends string>({ title, items, value, saved, level, owned = [], disabled, preview, onChange, note }: {
  title: string; items: readonly Choice<K>[]; value: K; saved: K; level: number; owned?: readonly string[]; disabled: boolean;
  preview: (key: K) => ReactNode; onChange: (key: K) => void; note?: string;
}) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const { trigger, position, place } = useAnchoredPopover<HTMLButtonElement>(open, 520);
  const usable = (item: Choice<K>) => item.level <= level || item.key === saved || owned.includes(item.key);
  // Gacha and brand frames not owned yet stay out of the list: they are not level rewards to wait for (brand frames have their own gallery).
  const shown = items.filter(item => !(item.special || item.brand) || usable(item) || item.key === value);
  const available = shown.filter(usable);
  const locked = shown.filter(item => !usable(item));
  const selected = items.find(item => item.key === value) ?? items[0]!;

  function choose(key: K) {
    onChange(key);
    panel.current?.hidePopover();
    trigger.current?.focus();
  }
  function move(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Home' && event.key !== 'End') return;
    const options = [...(panel.current?.querySelectorAll<HTMLButtonElement>('button[role=radio]:not(:disabled)') ?? [])];
    const index = options.indexOf(document.activeElement as HTMLButtonElement);
    const target = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : index + (event.key === 'ArrowDown' ? 1 : -1);
    options[(target + options.length) % options.length]?.focus();
    event.preventDefault();
  }
  const option = (item: Choice<K>) => {
    const isLocked = !usable(item);
    const gap = item.level - level;
    return <li key={item.key}>
      <button type="button" role="radio" aria-checked={item.key === value} disabled={isLocked} className="appearance-choice" onClick={() => choose(item.key)}>
        {preview(item.key)}
        <span className="appearance-choice-copy"><strong>{item.label}</strong>{item.special ? <span>Эксклюзив · {item.special}</span> : item.description && <span>{item.description}</span>}</span>
        <span className="appearance-choice-status">
          {isLocked ? <><LevelChip level={item.level} /><small>ещё {gap} {pluralRu(gap, 'уровень', 'уровня', 'уровней')}</small></>
            : item.key === value ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-label="Выбрано"><path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            : item.level > level && !item.special && !item.brand ? <small>Уже установлено</small> : null}
        </span>
      </button>
    </li>;
  };

  return <section className="appearance-island" aria-labelledby={`${id}-title`}>
    <div className="appearance-island-heading">
      <h3 id={`${id}-title`}>{title}</h3>
      <span>{available.length} из {shown.length}</span>
    </div>
    <button ref={trigger} type="button" className="appearance-trigger" popoverTarget={id} aria-expanded={open} aria-controls={id} aria-describedby={`${id}-title`} disabled={disabled} onClick={place}>
      {preview(selected.key)}
      <span className="appearance-choice-copy"><strong>{selected.label}</strong>{selected.description && <span>{selected.description}</span>}</span>
      <svg className="appearance-trigger-chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={open ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
    <div ref={panel} id={id} popover="auto" className="appearance-popover" style={position} onKeyDown={move}
      onToggle={event => {
        const shown = event.newState === 'open';
        setOpen(shown);
        if (!shown) return;
        place();
        panel.current?.querySelector<HTMLButtonElement>('button[aria-checked=true]:not(:disabled), button[role=radio]:not(:disabled)')?.focus();
      }}>
      <div role="radiogroup" aria-label={title}>
        <p className="appearance-group-title">Доступно</p>
        <ul>{available.map(option)}</ul>
        {locked.length > 0 && <>
          <p className="appearance-group-title">Откроется позже</p>
          <ul>{locked.map(option)}</ul>
        </>}
      </div>
      {note && <p className="appearance-popover-note">{note}</p>}
    </div>
  </section>;
}
