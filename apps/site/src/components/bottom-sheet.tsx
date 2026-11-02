'use client';
import type { ReactNode, Ref } from 'react';

/**
 * Лист снизу, как в трекере: на телефоне выезжает от нижнего края, на компьютере стоит окном по центру. Новое окно делай на
 * нём, а не своим `dialog`. Открывается `ref.current.showModal()`, закрывается нажатием на фон, Escape и `BottomSheetHead`.
 * `onClose` — только про сам лист: React поднимает `close` по дереву, и окно внутри него (жалоба в портале) иначе сбрасывало бы его состояние.
 */
export function BottomSheet({ ref, className, labelledBy, onClose, children }: { ref: Ref<HTMLDialogElement>; className?: string; labelledBy: string; onClose?: () => void; children: ReactNode }) {
  return <dialog ref={ref} className={className ? `bottom-sheet ${className}` : 'bottom-sheet'} aria-labelledby={labelledBy} onClose={event => { if (event.target === event.currentTarget) onClose?.(); }}
    onClick={event => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>{children}</dialog>;
}

/** Шапка листа: название и крестик, а на втором экране внутри листа — ещё стрелка назад. `actions` — меню «⋯» рядом с крестиком. */
export function BottomSheetHead({ id, title, onBack, actions, onClose }: { id: string; title: ReactNode; onBack?: () => void; actions?: ReactNode; onClose: () => void }) {
  return <div className="bottom-sheet-head">
    {onBack && <button type="button" className="bottom-sheet-close" onClick={onBack} aria-label="Назад">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg>
    </button>}
    <h2 id={id}>{title}</h2>
    {actions}
    <button type="button" className="bottom-sheet-close" onClick={onClose} aria-label="Закрыть">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
    </button>
  </div>;
}
