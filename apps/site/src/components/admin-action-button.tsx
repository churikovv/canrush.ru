'use client';

import type { MouseEvent, ReactNode } from 'react';
import { useFormStatus } from 'react-dom';

interface AdminActionButtonProps {
  children: ReactNode;
  pendingLabel: string;
  confirmMessage?: string;
  variant?: 'primary' | 'secondary' | 'danger';
}

export function AdminActionButton({
  children,
  pendingLabel,
  confirmMessage,
  variant = 'secondary',
}: AdminActionButtonProps) {
  const { pending } = useFormStatus();

  function confirmAction(event: MouseEvent<HTMLButtonElement>): void {
    if (confirmMessage && !window.confirm(confirmMessage)) event.preventDefault();
  }

  return (
    <button
      className={`admin-action-button admin-action-button-${variant}`}
      type="submit"
      disabled={pending}
      onClick={confirmAction}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
