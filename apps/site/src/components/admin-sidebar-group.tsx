'use client';
import { useId, useState, type ReactNode } from 'react';

/**
 * A category of the admin sidebar with a ▾ toggle, open by default. On phones the sidebar is one scrolling chip row:
 * the toggle hides and the items always show (admin.css), so nothing collapses out of reach there.
 */
export function AdminSidebarGroup({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  const id = useId();
  return <div className="admin-sidebar-group">
    <button type="button" className="admin-sidebar-toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M1 2.5h8L5 8 1 2.5Z" fill="currentColor" /></svg>{title}
    </button>
    <div id={id} className="admin-sidebar-items" hidden={!open}>{children}</div>
  </div>;
}
