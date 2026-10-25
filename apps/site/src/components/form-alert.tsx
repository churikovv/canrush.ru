import type { ReactNode } from 'react';

const ICONS = {
  // «!» in a circle: something stopped the action.
  error: <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4.5v6m0 3.25v.25" />,
  // «!» in a triangle: the action can still go on.
  warning: <path d="M10.3 4.2 2.6 17.6A2 2 0 0 0 4.3 20.6h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0ZM12 9v5m0 3v.2" />,
  success: <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm-4 9.2 2.7 2.8L16.2 9.4" />,
} as const;

/**
 * A form's message above its buttons: an icon, a tinted card in the tone's colour, plain text (not a bold red block) and
 * an optional row of actions — a link to the duplicate, «Всё равно отправить». `error` is announced as an alert.
 */
export function FormAlert({ tone = 'error', title, children, actions }: { tone?: keyof typeof ICONS; title?: ReactNode; children?: ReactNode; actions?: ReactNode }) {
  return <div className="form-alert" data-tone={tone} role={tone === 'success' ? 'status' : 'alert'}>
    <svg className="form-alert-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[tone]}</svg>
    <div className="form-alert-body">
      {title && <strong>{title}</strong>}
      {children && <p>{children}</p>}
      {actions && <div className="form-alert-actions">{actions}</div>}
    </div>
  </div>;
}
