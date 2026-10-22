'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { tierDiscussionAction } from '@/app/tierlists/discussion-actions';

const count = new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 });

/**
 * Like on a tier list card, without opening the list: the same `vote` as the discussion under the list
 * (a like replaces a dislike). A guest is sent to sign in; the author's own list shows only the count.
 */
export function TierLikeButton({ id, likes, vote, signedIn, own }: { id: string; likes: number; vote: number; signedIn: boolean; own: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState({ likes, vote });
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const liked = state.vote === 1;
  const heart = <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill={liked || own ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={liked || own ? 0 : 1.8} strokeLinejoin="round" d="M12 21s-7.5-4.6-9.6-9.3C.9 8.2 3 4.5 6.6 4.5c2.1 0 3.6 1.2 4.4 2.5.8-1.3 2.3-2.5 4.4-2.5 3.6 0 5.7 3.7 4.2 7.2C19.5 16.4 12 21 12 21Z" /></svg>;

  if (own) return <span className="tier-list-card-likes is-own" aria-label={`Лайки: ${state.likes}`}>{heart}{count.format(state.likes)}</span>;

  function toggle() {
    if (!signedIn) { router.push(`/sign-in?callbackURL=${encodeURIComponent(pathname)}`); return; }
    const previous = state;
    const next = liked ? 0 : 1;
    setError('');
    setState({ vote: next, likes: state.likes + (liked ? -1 : 1) });
    startTransition(async () => {
      const result = await tierDiscussionAction(id, 'vote', next);
      if ('interaction' in result && result.interaction) setState({ likes: result.interaction.likes, vote: result.interaction.vote });
      else { setState(previous); setError(result.error ?? 'Не удалось поставить лайк.'); }
    });
  }

  return <button type="button" className="tier-list-card-likes" aria-pressed={liked} disabled={pending}
    aria-label={`${liked ? 'Убрать лайк' : 'Поставить лайк'}. Лайки: ${state.likes}`} title={error || undefined} onClick={toggle}>
    {heart}{count.format(state.likes)}
    {error && <span className="sr-only" role="alert">{error}</span>}
  </button>;
}
