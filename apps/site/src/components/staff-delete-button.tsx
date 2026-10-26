'use client';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { staffDeleteAction } from '@/app/moderation-actions';
import { TrashIcon } from '@/components/action-icons';
import type { StaffDeleteKind } from '@/lib/staff-moderation';

const WHAT: Record<StaffDeleteKind, string> = {
  review: 'отзыв', 'review-comment': 'комментарий', 'tier-list': 'тирлист', 'tier-comment': 'комментарий',
  'wall-post': 'запись', 'wall-reply': 'комментарий', story: 'историю', article: 'статью',
};

/**
 * «Удалить» for admins and moderators: an item of the «⋯» menu (MoreActions) on someone else's content. Asks first,
 * deletes as staff (written to the admin audit log), then refreshes the page — or goes to `after` (a deleted tier
 * list has no page left) — and calls `onDeleted` for lists kept on the client.
 */
export function StaffDeleteMenuItem({ kind, id, after, onDeleted }: { kind: StaffDeleteKind; id: string; after?: string; onDeleted?: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function remove() {
    if (!window.confirm(`Удалить ${WHAT[kind]} как модератор? Это нельзя отменить, действие попадёт в журнал админки.`)) return;
    startTransition(async () => {
      const result = await staffDeleteAction(kind, id).catch(() => ({ error: 'Нет связи с сервером. Попробуйте ещё раз.' }));
      if (result.error) { window.alert(result.error); return; }
      onDeleted?.();
      if (after) router.push(after); else router.refresh();
    });
  }
  return <button className="more-actions-item is-danger" type="button" role="menuitem" disabled={pending} onClick={remove}><TrashIcon /><span>Удалить</span></button>;
}
