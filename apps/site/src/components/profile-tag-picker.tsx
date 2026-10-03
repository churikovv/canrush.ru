'use client';

import { useActionState, useCallback, useEffect, useId, useRef, useState } from 'react';
import { updateCommunityAction } from '@/app/profile/community-actions';
import { profileTagLabel, visibleProfileAchievements, type AchievementProgress } from '@/lib/profile-achievements';

export function AchievementPicker({ earned, selected, progress, isOwn, viewerIsAdmin = false }: {
  earned: string[]; selected: string[]; progress: AchievementProgress; isOwn: boolean; viewerIsAdmin?: boolean;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [tag, setTag] = useState(selected[0] ?? '');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, maxHeight: 400 });
  const [state, action, pending] = useActionState(updateCommunityAction, {});
  const items = visibleProfileAchievements(viewerIsAdmin);
  const matching = items.filter(item => `${item.label} ${item.description}`.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru')));
  const current = items.find(item => item.key === tag);

  const placePanel = useCallback(() => {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const viewport = window.visualViewport;
    const height = viewport?.height ?? window.innerHeight;
    const offset = viewport?.offsetTop ?? 0;
    // The CSS offset contains calc()/safe-area values; measure the actual bar instead of parsing it.
    const tabBar = document.querySelector('.site-tab-bar')?.getBoundingClientRect().height ?? 0;
    const below = height + offset - rect.bottom - tabBar - 20;
    const above = rect.top - offset - 20;
    const upwards = below < 260 && above > below;
    const maxHeight = Math.max(140, Math.min(420, upwards ? above : below));
    setPosition({ top: upwards ? rect.top - maxHeight - 8 : rect.bottom + 8,
      left: Math.max(12, Math.min(rect.left, window.innerWidth - rect.width - 12)),
      width: Math.min(rect.width, window.innerWidth - 24), maxHeight });
  }, []);

  useEffect(() => {
    if (!open) return;
    const reposition = () => placePanel();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    window.visualViewport?.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
      window.visualViewport?.removeEventListener('resize', reposition);
    };
  }, [open, placePanel]);

  function choose(value: string) {
    setTag(value);
    panel.current?.hidePopover();
    trigger.current?.focus();
  }

  const contents = <>
    <button ref={trigger} type="button" className="tag-picker-trigger" popoverTarget={id} aria-expanded={open} aria-controls={id}
      disabled={pending} onClick={() => { if (!open) setQuery(''); placePanel(); }}>
      <span>{current ? <span className="profile-tag">{current.label}</span> : isOwn ? 'Выберите тег' : 'Посмотреть все теги'}</span>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={open ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
    <div ref={panel} id={id} popover="auto" className="tag-picker-popover" style={position}
      onToggle={event => {
        const shown = event.newState === 'open';
        setOpen(shown);
        if (shown) placePanel();
      }}>
      <div className="tag-picker-search">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.7" /><path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
        <label className="sr-only" htmlFor={`${id}-search`}>Найти тег или условие получения</label>
        <input id={`${id}-search`} type="search" value={query} onChange={event => { setQuery(event.target.value); placePanel(); }} onKeyDown={event => { if (event.key === 'Enter') event.preventDefault(); }} placeholder="Найти тег" autoComplete="off" />
      </div>
      <div className="tag-picker-options" role={isOwn ? 'radiogroup' : undefined} aria-label="Теги и условия получения">
        {isOwn && !query.trim() && <label className="tag-picker-option">
          <input type="radio" name="tag-choice" checked={!tag} onChange={() => choose('')} />
          <span className="achievement-copy"><strong>Без тега</strong><span>Только имя и уровень</span></span>
        </label>}
        {matching.map(item => {
          const unlocked = earned.includes(item.key);
          const copy = <><span className="achievement-copy"><strong>{item.label}</strong><span>{item.description}</span></span>
            <span className={`achievement-progress${unlocked ? ' is-earned' : ''}`}>{unlocked ? 'Получен' : `${Math.min(progress[item.metric], item.goal)} / ${item.goal}`}</span></>;
          return isOwn ? <label className={`tag-picker-option${tag === item.key ? ' is-selected' : ''}${!unlocked ? ' is-locked' : ''}`} key={item.key}>
            <input type="radio" name="tag-choice" checked={tag === item.key} disabled={!unlocked || pending} onChange={() => choose(item.key)} />{copy}
          </label> : <div className="tag-picker-option" key={item.key}>{copy}</div>;
        })}
        {!matching.length && <p className="tag-picker-empty" role="status">Тег не найден. Попробуйте другое название.</p>}
      </div>
    </div>
    {isOwn && <>
      <input type="hidden" name="operation" value="tags" />
      {tag && <input type="hidden" name="tags" value={tag} />}
      <div className="community-form-footer"><span className="community-muted">{tag ? `Выбран: ${profileTagLabel(tag)}` : 'Можно выбрать один тег'}</span>
        <button type="submit" className="community-button" disabled={pending || tag === (selected[0] ?? '')}>{pending ? 'Сохраняем…' : 'Сохранить тег'}</button>
      </div>
      <p className={state.error ? 'field-error' : 'community-feedback'} role={state.error ? 'alert' : 'status'}>{state.error ?? state.success}</p>
    </>}
  </>;
  return isOwn ? <form action={action} className="achievement-form">{contents}</form> : <div className="achievement-form">{contents}</div>;
}
