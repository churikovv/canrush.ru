'use client';
import { useRef } from 'react';
import type { MediaAttachments } from '@/components/media-attachments';
import { MoreActions } from '@/components/more-actions';
import { useDrinkSheet, type WallDrinkState } from '@/components/wall-drink';
import { MAX_WALL_MEDIA, WALL_MEDIA_ACCEPT } from '@/lib/wall-media-limits';

/**
 * The paperclip of a wall or feed composer: a menu with «Фото, GIF или видео» (the hidden file picker) and «Энергетик»
 * (the catalog sheet, `useDrinkSheet`). The file input lives outside the menu and is clicked from the item, inside the
 * same tap, so the system picker opens on phones too. Pasting a picture into the field still attaches it.
 */
export function AttachMenu({ media, drink, label }: { media: MediaAttachments; drink: WallDrinkState; label: string }) {
  const input = useRef<HTMLInputElement>(null);
  const sheet = useDrinkSheet(drink);
  const full = media.files.length >= MAX_WALL_MEDIA || media.preparing;
  return <>
    <MoreActions label={label} align="start" className="attach-menu" icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m20.5 11.2-8.3 8.3a5.2 5.2 0 0 1-7.4-7.4l8.6-8.6a3.4 3.4 0 0 1 4.9 4.9l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l7.9-7.9" /></svg>}>
      <button type="button" className="more-actions-item" role="menuitem" disabled={full} onClick={() => input.current?.click()}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4" /><circle cx="9" cy="9" r="1.8" /><path d="m4 18 5-5 4 4 3-3 4 4" /></svg>
        <span>Фото, GIF или видео<small>{full ? `уже ${MAX_WALL_MEDIA} из ${MAX_WALL_MEDIA}` : `до ${MAX_WALL_MEDIA} штук`}</small></span>
      </button>
      <button type="button" className="more-actions-item" role="menuitem" onClick={sheet.open}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 3h8M7.5 5.5h9l-.6 14a1.5 1.5 0 0 1-1.5 1.5H9.6a1.5 1.5 0 0 1-1.5-1.5Z" /><path d="m12.6 9-2 3.4h2.8l-2 3.4" /></svg>
        <span>{drink.drink ? 'Сменить энергетик' : 'Энергетик'}<small>карточка из каталога</small></span>
      </button>
    </MoreActions>
    <input ref={input} type="file" accept={WALL_MEDIA_ACCEPT} multiple className="sr-only" tabIndex={-1} aria-hidden="true" disabled={full}
      onChange={event => { void media.add(Array.from(event.currentTarget.files ?? [])); event.currentTarget.value = ''; }} />
    {sheet.element}
  </>;
}
