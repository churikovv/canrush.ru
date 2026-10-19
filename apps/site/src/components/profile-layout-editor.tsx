'use client';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { DEFAULT_PROFILE_LAYOUT, PROFILE_BLOCKS, PROFILE_BLOCK_FIELDS, isRequiredProfileBlock, parseProfileLayout, placeProfileBlock, type ProfileLayout, type ProfileBlockKey } from '@/lib/profile-layout';

const EASING = 'cubic-bezier(.2,.8,.2,1)';

export function ProfileLayoutEditor({ initial = DEFAULT_PROFILE_LAYOUT, disabled, previews }: { initial?: ProfileLayout; disabled: boolean; previews?: Partial<Record<ProfileBlockKey, ReactNode>> }) {
  const [layout, setLayout] = useState(() => parseProfileLayout(initial) ?? DEFAULT_PROFILE_LAYOUT);
  const [drag, setDrag] = useState<ProfileBlockKey | null>(null);
  const [notice, setNotice] = useState('');
  const blocks = useRef(new Map<ProfileBlockKey, HTMLElement>());
  const before = useRef<{ rects: Map<ProfileBlockKey, DOMRect>; lifted: ProfileBlockKey | null } | null>(null);

  // FLIP: blocks start from their previous on-screen position and glide into the new layout.
  useLayoutEffect(() => {
    const snapshot = before.current;
    before.current = null;
    if (!snapshot || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    for (const [key, element] of blocks.current) {
      const previous = snapshot.rects.get(key);
      if (!previous) continue;
      element.getAnimations().forEach(animation => animation.cancel());
      const current = element.getBoundingClientRect();
      const dx = previous.left - current.left, dy = previous.top - current.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      const lifted = key === snapshot.lifted;
      element.animate(lifted
        ? [{ transform: `translate(${dx}px, ${dy}px) scale(1.02)`, boxShadow: '0 18px 36px rgb(10 16 30 / .22)', zIndex: 2 }, { transform: 'none', boxShadow: '0 0 0 transparent', zIndex: 2 }]
        : [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: lifted ? 420 : 340, easing: EASING });
    }
  }, [layout]);

  function update(next: ProfileLayout, lifted: ProfileBlockKey | null = null) {
    before.current = { rects: new Map([...blocks.current].map(([key, element]) => [key, element.getBoundingClientRect()])), lifted };
    setLayout(next);
  }
  function place(key: ProfileBlockKey, target: ProfileBlockKey, after: boolean, lifted: ProfileBlockKey | null) {
    const order = placeProfileBlock(layout.order, key, target, after);
    if (order) update({ ...layout, order }, lifted);
    return Boolean(order);
  }

  return <section className="profile-layout-editor" aria-labelledby="layout-editor-title">
    <div className="community-section-heading"><h2 id="layout-editor-title">Вид профиля</h2><button type="button" className="community-button community-button-secondary" disabled={disabled} onClick={() => { update(DEFAULT_PROFILE_LAYOUT); setNotice('Стандартный вид восстановлен'); }}>Сбросить</button></div>
    <p className="community-section-note">Перетаскивайте блоки или используйте стрелки. Скрытые блоки сохраняют свои данные. Изменения появятся у посетителей после сохранения профиля.</p>
    <input type="hidden" name="profileLayout" value={JSON.stringify(layout)} />
    <div className="profile-layout-columns">{(['main', 'side'] as const).map(area => {
      const keys = layout.order.filter(key => PROFILE_BLOCKS.find(x => x.key === key)?.area === area);
      return <div key={area} className="profile-layout-column"><h3>{area === 'main' ? 'Основная колонка' : 'Боковая колонка'}</h3><div className="profile-layout-stack">{keys.map((key, index) => {
        const block = PROFILE_BLOCKS.find(x => x.key === key)!;
        const hidden = layout.hidden.includes(key);
        return <article
          className={`profile-layout-block${hidden ? ' is-hidden' : ''}${drag === key ? ' is-dragging' : ''}`}
          key={key}
          ref={element => { if (element) blocks.current.set(key, element); else blocks.current.delete(key); }}
          onDragOver={event => {
            if (disabled || !drag || !keys.includes(drag)) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            if (drag === key) return;
            const rect = event.currentTarget.getBoundingClientRect();
            place(drag, key, event.clientY > rect.top + rect.height / 2, null);
          }}
          onDrop={event => { event.preventDefault(); setDrag(null); setNotice('Порядок блоков изменён'); }}
        >
          <header>
            <button className="layout-drag" type="button" draggable={!disabled} disabled={disabled} aria-label={`Перетащить: ${block.label}`} onDragStart={event => {
              const card = event.currentTarget.closest('article');
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', key);
              if (card) { const rect = card.getBoundingClientRect(); event.dataTransfer.setDragImage(card, event.clientX - rect.left, event.clientY - rect.top); }
              setDrag(key);
            }} onDragEnd={() => setDrag(null)}>⠿</button>
            <strong>{block.label}</strong>
            <div className="layout-block-actions">{([-1, 1] as const).map(direction => <button type="button" key={direction} disabled={disabled || !keys[index + direction]} aria-label={`${block.label}: ${direction < 0 ? 'выше' : 'ниже'}`} onClick={() => { if (place(key, keys[index + direction]!, direction > 0, key)) setNotice(`${block.label}: ${direction < 0 ? 'выше' : 'ниже'}`); }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={direction < 0 ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'} /></svg></button>)}</div>
          </header>
          {/* The about block is previewed by its own row switches below. */}
          {!hidden && key !== 'about' && <div className="layout-live-preview" data-block={key} inert>{previews?.[key] ?? <p>{block.label}</p>}</div>}
          {!hidden && key === 'about' && <fieldset className="layout-block-fields" disabled={disabled}><legend className="sr-only">Что показывать в блоке «{block.label}»</legend>{PROFILE_BLOCK_FIELDS.about.map(field => {
            const shown = !layout.hiddenFields?.includes(field.key);
            return <label key={field.key}><input type="checkbox" checked={shown} onChange={() => {
              const rest = (layout.hiddenFields ?? []).filter(item => item !== field.key);
              const hiddenFields = shown ? [...rest, field.key] : rest;
              update({ order: layout.order, hidden: layout.hidden, ...(hiddenFields.length ? { hiddenFields } : {}) });
            }} />{field.label}</label>;
          })}</fieldset>}
          {isRequiredProfileBlock(key) ? <p className="community-muted layout-block-footer">Всегда отображается</p> : <label className="layout-block-footer"><input type="checkbox" checked={!hidden} disabled={disabled} onChange={() => update({ ...layout, hidden: hidden ? layout.hidden.filter(x => x !== key) : [...layout.hidden, key] })} />{hidden ? 'Скрыт в профиле' : 'Показывать в профиле'}</label>}
        </article>;
      })}</div></div>;
    })}</div><p className="sr-only" role="status">{notice}</p>
  </section>;
}
