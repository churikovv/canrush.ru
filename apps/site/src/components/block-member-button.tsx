'use client';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { setMemberBlockAction } from '@/app/profile/block-actions';

/**
 * «Заблокировать» / «Разблокировать» a member. A blocked member cannot comment on, reply to, follow, order from
 * or message the viewer, and the viewer stops seeing their posts, comments and reviews.
 */
function BanIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="m5.6 5.6 12.8 12.8" /></svg>;
}

/** `menuitem` — an item of the «⋯» menu (MoreActions); its error comes as an alert, since the menu closes. */
export function BlockMemberButton({ userId, name, initiallyBlocked = false, compact = false, variant = 'button' }: { userId: string; name: string; initiallyBlocked?: boolean; compact?: boolean; variant?: 'button' | 'menuitem' }) {
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
        if (result.error) { fail(result.error); return; }
        setBlocked(Boolean(result.blocked));
        router.refresh();
      } catch { fail('Нет связи с сервером. Попробуйте ещё раз.'); }
    });
  }
  function fail(message: string) { if (variant === 'menuitem') window.alert(message); else setError(message); }
  if (variant === 'menuitem') return <button className={`more-actions-item${blocked ? '' : ' is-danger'}`} type="button" role="menuitem" disabled={pending} onClick={toggle}>
    <BanIcon /><span>{blocked ? 'Разблокировать' : 'Заблокировать'}</span>
  </button>;
  const button = <button className={`community-button community-button-secondary${blocked ? '' : ' block-member-action'}`} type="button" disabled={pending} onClick={toggle}>
    {!blocked && <BanIcon />}{pending ? 'Сохраняем…' : blocked ? 'Разблокировать' : `Заблокировать ${name}`}
  </button>;
  // Blocked: a notice with what the block does and a small «Разблокировать» beside it (stacked on phones).
  return <div className={`block-member${compact ? ' is-compact' : ''}${blocked && !compact ? ' is-blocked' : ''}`}>
    {!compact && blocked ? <div className="block-member-notice" role="status">
      <span className="block-member-icon" aria-hidden="true"><BanIcon /></span>
      <span className="block-member-text"><strong>Вы заблокировали {name}</strong><small>Записи, комментарии и отзывы участника скрыты, он не может писать вам и заказывать у вас.</small></span>
      {button}
    </div> : button}
    {error && <p className="field-error" role="alert">{error}</p>}
  </div>;
}
