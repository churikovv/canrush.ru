'use client';

import NextLink, { useLinkStatus } from 'next/link';
import { createContext, useCallback, useContext, useEffect, useId, useState, type ComponentProps, type ReactNode } from 'react';
import { SiteLoading } from './site-loading';

const NavigationProgressContext = createContext<(id: string, pending: boolean) => void>(() => {});
export const NAVIGATION_LOADING_DELAY_MS = 800;

export function NavigationProgressProvider({ children }: { children: ReactNode }) {
  const [pendingLinks, setPendingLinks] = useState<Set<string>>(() => new Set());
  const [visible, setVisible] = useState(false);
  const pending = pendingLinks.size > 0;
  const update = useCallback((id: string, active: boolean) => {
    setPendingLinks(previous => {
      if (previous.has(id) === active) return previous;
      const next = new Set(previous);
      if (active) next.add(id); else next.delete(id);
      return next;
    });
  }, []);
  useEffect(() => {
    if (!pending) return;
    const timer = window.setTimeout(() => setVisible(true), NAVIGATION_LOADING_DELAY_MS);
    return () => { window.clearTimeout(timer); setVisible(false); };
  }, [pending]);
  return <NavigationProgressContext.Provider value={update}>
    {children}
    {pending && visible && <div className="navigation-loading-overlay"><SiteLoading embedded /></div>}
  </NavigationProgressContext.Provider>;
}

function LinkProgress() {
  const { pending } = useLinkStatus();
  const update = useContext(NavigationProgressContext);
  const id = useId();
  useEffect(() => {
    update(id, pending);
    return () => update(id, false);
  }, [id, pending, update]);
  return null;
}

/** Preserve Next's own transitions, prefetch, modifiers, refs and navigation cancellation. */
export default function Link({ children, ...props }: ComponentProps<typeof NextLink>) {
  return <NextLink {...props}>{children}<LinkProgress /></NextLink>;
}
