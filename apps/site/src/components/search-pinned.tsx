import type { ReactNode } from 'react';

/** On /search the section's own controls and the scope switcher under them stay pinned while scrolling. */
export function Pinned({ scopes, children }: { scopes?: ReactNode; children: ReactNode }) {
  return scopes ? <div className="search-pinned">{children}{scopes}</div> : <>{children}</>;
}
