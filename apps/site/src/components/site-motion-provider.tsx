'use client';

import { useEffect, type ReactNode } from 'react';
import { animate, hover, press } from 'motion';
import { MotionConfig } from 'motion/react';

const PRESSABLE_SELECTOR = [
  'button:not(.motion-local):not(:disabled)',
  'a.profile-navigation-item',
  'a.profile-edit-link',
  'a.catalog-card-link',
  'a.catalog-favorite-button',
  'a.favorite-card-link',
  'a.tier-primary-action',
  'a.tier-secondary-action',
  'a.tier-list-card-preview',
].join(',');

const HOVERABLE_SELECTOR = [
  'a.catalog-card-link',
  'a.tier-list-card-preview',
  'a.profile-navigation-item',
].join(',');

function useSiteMicroInteractions(): void {
  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pressDisposers = new Map<HTMLElement, () => void>();
    const hoverDisposers = new Map<HTMLElement, () => void>();

    function bindInteractions(): void {
      for (const [element, dispose] of pressDisposers) {
        if (!element.isConnected) {
          dispose();
          pressDisposers.delete(element);
        }
      }
      for (const [element, dispose] of hoverDisposers) {
        if (!element.isConnected) {
          dispose();
          hoverDisposers.delete(element);
        }
      }

      document.querySelectorAll<HTMLElement>(PRESSABLE_SELECTOR).forEach((element) => {
        if (pressDisposers.has(element)) return;
        pressDisposers.set(
          element,
          press(element, (target) => {
            if (reducedMotion.matches || target.matches(':disabled')) return;
            animate(target, { scale: 0.975 }, { duration: 0.08, ease: 'easeOut' });
            return () => animate(target, { scale: 1 }, { type: 'spring', stiffness: 520, damping: 32 });
          }),
        );
      });

      document.querySelectorAll<HTMLElement>(HOVERABLE_SELECTOR).forEach((element) => {
        if (hoverDisposers.has(element)) return;
        hoverDisposers.set(
          element,
          hover(element, (target) => {
            if (reducedMotion.matches) return;
            animate(target, { y: -2 }, { duration: 0.18, ease: 'easeOut' });
            return () => animate(target, { y: 0 }, { duration: 0.16, ease: 'easeOut' });
          }),
        );
      });
    }

    bindInteractions();
    const observer = new MutationObserver(bindInteractions);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      pressDisposers.forEach((dispose) => dispose());
      hoverDisposers.forEach((dispose) => dispose());
    };
  }, []);
}

export function SiteMotionProvider({ children }: { children: ReactNode }) {
  useSiteMicroInteractions();

  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}>
      {children}
    </MotionConfig>
  );
}
