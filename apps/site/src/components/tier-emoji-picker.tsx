'use client';
import { useId, useRef, useState } from 'react';
import { TIER_LIST_EMOJIS } from '@/lib/tier-list-types';
import { useAnchoredPopover } from '@/lib/use-anchored-popover';

/** Emoji before the tier list title: a button with a popover grid of `TIER_LIST_EMOJIS`, the choice goes in `emoji`. */
export function TierEmojiPicker({ initial, onChange }: { initial: string | null; onChange?: () => void }) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const [emoji, setEmoji] = useState(initial ?? '');
  const [open, setOpen] = useState(false);
  const { trigger, position, place } = useAnchoredPopover<HTMLButtonElement>(open, 320);

  function choose(value: string) {
    setEmoji(value);
    onChange?.();
    panel.current?.hidePopover();
    trigger.current?.focus();
  }

  return <>
    <input type="hidden" name="emoji" value={emoji} />
    <button ref={trigger} type="button" className="tier-emoji-trigger" popoverTarget={id} aria-expanded={open} aria-controls={id}
      aria-label={emoji ? `Эмодзи тирлиста: ${emoji}. Изменить` : 'Добавить эмодзи'} onClick={place}>
      {emoji ? <span aria-hidden="true">{emoji}</span> : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="M20.9 13A9 9 0 1 1 11 3.1" /><path d="M8.5 14.5s1.2 1.8 3.5 1.8 3.5-1.8 3.5-1.8M9 9.5h.01M15 9.5h.01M19 2v6M16 5h6" /></svg>}
    </button>
    <div ref={panel} id={id} popover="auto" className="tier-emoji-popover" style={{ top: position.top, left: position.left, maxHeight: position.maxHeight }}
      onToggle={event => { const shown = event.newState === 'open'; setOpen(shown); if (shown) place(); }}>
      <div className="tier-emoji-grid" role="radiogroup" aria-label="Эмодзи тирлиста">
        {TIER_LIST_EMOJIS.map(value => <button key={value} type="button" role="radio" aria-checked={emoji === value} className={emoji === value ? 'is-selected' : undefined} onClick={() => choose(value)}>{value}</button>)}
      </div>
      {emoji && <button type="button" className="tier-emoji-clear" onClick={() => choose('')}>Без эмодзи</button>}
    </div>
  </>;
}
