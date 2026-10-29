'use client';
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { AvatarFrame } from '@/components/avatar-frame';
import { LevelChip, LevelEmblem } from '@/components/level-badge';
import { ProfileStatFill } from '@/components/profile-stat-fill';
import { pluralRu } from '@/lib/drink-calendar-fields';
import { experienceForLevel, experienceLevel } from '@/lib/experience-level';
import { levelRank } from '@/lib/level-tier';
import { PROFILE_THEMES, PROFILE_FRAMES, DEFAULT_PROFILE_APPEARANCE, nextAppearanceUnlock, type ProfileAppearance } from '@/lib/profile-appearance';
import { useAnchoredPopover } from '@/lib/use-anchored-popover';

type Choice<K extends string> = { key: K; level: number; label: string; description?: string };

export function ProfileAppearanceEditor({ value, onChange, disabled, level, xp, current }: { level: number; xp?: number; current: ProfileAppearance; value: ProfileAppearance; onChange: (value: ProfileAppearance) => void; disabled: boolean }) {
  return <section className="profile-appearance-editor" aria-labelledby="appearance-title">
    <div className="community-section-heading"><h2 id="appearance-title">Оформление</h2><button type="button" className="community-button community-button-secondary" disabled={disabled} onClick={() => onChange(DEFAULT_PROFILE_APPEARANCE)}>Сбросить оформление</button></div>
    <p className="community-section-note">Цвет и рамка видны всем посетителям. Шапка сверху показывает ваш выбор до сохранения.</p>
    <div className="appearance-islands">
      <AppearanceLevel level={level} xp={xp ?? experienceForLevel(level)} />
      <AppearancePicker title="Цвет профиля" items={PROFILE_THEMES} value={value.theme} saved={current.theme} level={level} disabled={disabled}
        preview={key => <ThemePreview theme={key} />} onChange={theme => onChange({ ...value, theme })} />
      <AppearancePicker title="Рамка аватарки" items={PROFILE_FRAMES} value={value.frame} saved={current.frame} level={level} disabled={disabled}
        preview={key => <span className="appearance-frame-sample community-avatar" data-frame={key} aria-hidden="true">C<AvatarFrame frame={key} /></span>}
        onChange={frame => onChange({ ...value, frame })} note="Анимация рамок отключается, если на устройстве включено уменьшение движения." />
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
      <p className="appearance-level-count">Темы {opened(PROFILE_THEMES)} из {PROFILE_THEMES.length} · Рамки {opened(PROFILE_FRAMES)} из {PROFILE_FRAMES.length}</p>
    </div>
  </section>;
}

function ThemePreview({ theme }: { theme: string }) {
  return <span className="appearance-swatch" data-profile-theme={theme} aria-hidden="true"><i /><i /><i /><i /></span>;
}

function AppearancePicker<K extends string>({ title, items, value, saved, level, disabled, preview, onChange, note }: {
  title: string; items: readonly Choice<K>[]; value: K; saved: K; level: number; disabled: boolean;
  preview: (key: K) => ReactNode; onChange: (key: K) => void; note?: string;
}) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const { trigger, position, place } = useAnchoredPopover<HTMLButtonElement>(open, 520);
  const usable = (item: Choice<K>) => item.level <= level || item.key === saved;
  const available = items.filter(usable);
  const locked = items.filter(item => !usable(item));
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
        <span className="appearance-choice-copy"><strong>{item.label}</strong>{item.description && <span>{item.description}</span>}</span>
        <span className="appearance-choice-status">
          {isLocked ? <><LevelChip level={item.level} /><small>ещё {gap} {pluralRu(gap, 'уровень', 'уровня', 'уровней')}</small></>
            : item.key === value ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-label="Выбрано"><path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            : item.level > level ? <small>Уже установлено</small> : null}
        </span>
      </button>
    </li>;
  };

  return <section className="appearance-island" aria-labelledby={`${id}-title`}>
    <div className="appearance-island-heading">
      <h3 id={`${id}-title`}>{title}</h3>
      <span>{available.length} из {items.length}</span>
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
