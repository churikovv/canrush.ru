'use client';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { setMemberBlockAction } from '@/app/profile/block-actions';

/**
 * «Заблокировать» / «Разблокировать» a member. A blocked member cannot comment on, reply to, follow, order from
 * or message the viewer, and the viewer stops seeing their posts, comments and reviews.
 */
export function BlockMemberButton({ userId, name, initiallyBlocked = false, compact = false }: { userId: string; name: string; initiallyBlocked?: boolean; compact?: boolean }) {
  const router = useRouter();
  const [blocked, setBlocked] = useState(initiallyBlocked);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  function toggle() {
    if (!blocked && !window.confirm(`Заблокировать ${name}? Вы перестанете видеть записи, комментарии и отзывы участника, а он не сможет отвечать вам, писать на вашей стене, подписываться и заказывать у вас.`)) return;
    setError('');
    startTransition(async () => {
      try {
        const result = await setMemberBlockAction(userId, !blocked);
        if (result.error) { setError(result.error); return; }
        setBlocked(Boolean(result.blocked));
        router.refresh();
      } catch { setError('Нет связи с сервером. Попробуйте ещё раз.'); }
    });
  }
  return <div className={`block-member${compact ? ' is-compact' : ''}`}>
    {!compact && blocked && <p className="community-muted" role="status">Вы заблокировали {name}.</p>}
    <button className="community-button community-button-secondary" type="button" disabled={pending} onClick={toggle}>
      {pending ? 'Сохраняем…' : blocked ? 'Разблокировать' : `Заблокировать ${name}`}
    </button>
    {error && <p className="field-error" role="alert">{error}</p>}
  </div>;
}
