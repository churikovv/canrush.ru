'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Places a `popover` panel under its trigger (or above it when there is more room), clear of the tab bar. The panel is
 * as wide as the trigger, or `minWidth` for a small trigger (a tile in a strip), and stays inside the screen.
 */
export function useAnchoredPopover<T extends HTMLElement>(open: boolean, maxPanelHeight = 420, minWidth = 0) {
  const trigger = useRef<T>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, maxHeight: 400 });

  const place = useCallback(() => {
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
    const maxHeight = Math.max(140, Math.min(maxPanelHeight, upwards ? above : below));
    const width = Math.min(Math.max(rect.width, minWidth), window.innerWidth - 24);
    setPosition({ top: upwards ? rect.top - maxHeight - 8 : rect.bottom + 8,
      left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), width, maxHeight });
  }, [maxPanelHeight, minWidth]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    window.visualViewport?.addEventListener('resize', place);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      window.visualViewport?.removeEventListener('resize', place);
    };
  }, [open, place]);

  return { trigger, position, place };
}
