'use client';
import { useState, type ReactNode } from 'react';
import { DEFAULT_PROFILE_LAYOUT, PROFILE_BLOCKS, type ProfileLayout, type ProfileBlockKey } from '@/lib/profile-layout';
export function ProfileLayoutEditor({ initial = DEFAULT_PROFILE_LAYOUT, disabled, previews }: { initial?: ProfileLayout; disabled: boolean; previews?: Partial<Record<ProfileBlockKey, ReactNode>> }) {
  const [layout, setLayout] = useState(initial);
  const [drag, setDrag] = useState<ProfileBlockKey | null>(null);
  const [notice, setNotice] = useState('');
  function move(key: ProfileBlockKey, target: ProfileBlockKey) {
    if (key === target) return;
    setLayout(current => { const order = current.order.filter(x => x !== key); order.splice(current.order.indexOf(target), 0, key); return { ...current, order }; });
    setNotice('Порядок блоков изменён');
  }
  return <section className="profile-layout-editor" aria-labelledby="layout-editor-title">
    <div className="community-section-heading"><h2 id="layout-editor-title">Вид профиля</h2><button type="button" className="community-button community-button-secondary" disabled={disabled} onClick={() => { setLayout(DEFAULT_PROFILE_LAYOUT); setNotice('Стандартный вид восстановлен'); }}>Сбросить</button></div>
    <p className="community-section-note">Перетаскивайте блоки или используйте стрелки. Скрытые блоки сохраняют свои данные. Изменения появятся у посетителей после сохранения профиля.</p>
    <input type="hidden" name="profileLayout" value={JSON.stringify(layout)} />
    <div className="profile-layout-columns">{(['main', 'side'] as const).map(area => {
      const keys = layout.order.filter(key => PROFILE_BLOCKS.find(x => x.key === key)?.area === area);
      return <div key={area}><h3>{area === 'main' ? 'Основная колонка' : 'Боковая колонка'}</h3><div className="profile-layout-stack">{keys.map((key, index) => {
        const block = PROFILE_BLOCKS.find(x => x.key === key)!;
        const hidden = layout.hidden.includes(key);
        return <article className={`profile-layout-block${hidden ? ' is-hidden' : ''}`} key={key} onDragOver={event => { if (drag && keys.includes(drag)) event.preventDefault(); }} onDrop={event => { event.preventDefault(); if (!disabled && drag && keys.includes(drag)) move(drag, key); setDrag(null); }}>
          <header><button className="layout-drag" type="button" draggable={!disabled} disabled={disabled} aria-label={`Перетащить: ${block.label}`} onDragStart={() => setDrag(key)} onDragEnd={() => setDrag(null)}>⠿</button><strong>{block.label}</strong><div className="layout-block-actions">{([-1, 1] as const).map(direction => <button type="button" key={direction} disabled={disabled || !keys[index + direction]} aria-label={`${block.label}: ${direction < 0 ? 'выше' : 'ниже'}`} onClick={() => move(key, keys[index + direction]!)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={direction < 0 ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'} /></svg></button>)}</div></header>
          {!hidden && <div className="layout-live-preview" inert>{previews?.[key] ?? <p>{block.label}</p>}</div>}
          <label><input type="checkbox" checked={!hidden} disabled={disabled} onChange={() => setLayout(current => ({ ...current, hidden: hidden ? current.hidden.filter(x => x !== key) : [...current.hidden, key] }))} />{hidden ? 'Скрыт в профиле' : 'Показывать в профиле'}</label>
        </article>;
      })}</div></div>;
    })}</div><p className="sr-only" role="status">{notice}</p>
  </section>;
}
