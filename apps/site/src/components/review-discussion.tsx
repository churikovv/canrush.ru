'use client';
import Link from '@/components/navigation-progress';
import Image from 'next/image';
import { useId, useState, useTransition } from 'react';
import { tierDiscussionAction } from '@/app/tierlists/discussion-actions';
import { reviewDiscussionAction } from '@/app/catalog/discussion-actions';
import type { ReviewCommentData, ReviewInteraction } from '@/lib/review-discussions';

function Thumb({ down = false }: { down?: boolean }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={down ? { transform: 'rotate(180deg)' } : undefined}><path d="M7 10v11H3V10h4Zm0 0 5-8c3 0 3 3 2 7h5a2 2 0 0 1 2 2l-2 8a2 2 0 0 1-2 2H7" /></svg>;
}
export function ReviewDiscussion({ reviewId, initial, telegramChannel, target = 'review', reactionsEnabled = true, commentsEnabled = true }: { reviewId: string; initial?: ReviewInteraction; telegramChannel?: string | null; target?: 'review' | 'tierlist'; reactionsEnabled?: boolean; commentsEnabled?: boolean }) {
  const [stats,setStats] = useState(initial ?? { likes: 0, dislikes: 0, comments: 0, vote: 0, authenticated: false });
  const [open,setOpen] = useState(false);
  const [loaded,setLoaded] = useState(false);
  const [comments,setComments] = useState<ReviewCommentData[]>([]);
  const [more,setMore] = useState(false);
  const [text,setText] = useState('');
  const [error,setError] = useState('');
  const [signIn,setSignIn] = useState(false);
  const [pending,startTransition] = useTransition();
  const regionId = useId();
  function run(action: 'read' | 'vote' | 'comment' | 'delete', value?: string | number, append = false) {
    setError(''); setSignIn(false);
    startTransition(async () => {
      try {
        const result = await (target === 'tierlist' ? tierDiscussionAction : reviewDiscussionAction)(reviewId, action, value);
        if (result.error) { setError(result.error); setSignIn(Boolean(result.signIn)); return; }
        if (result.interaction) setStats(result.interaction);
        if (result.thread) { setComments(previous => append ? [...previous,...result.thread!.items.filter(item => !previous.some(old => old.id === item.id))] : result.thread!.items); setMore(result.thread.hasMore); setLoaded(true); }
        if (action === 'comment') setText('');
      } catch { setError('Нет связи с сервером. Попробуйте ещё раз.'); }
    });
  }
  return <footer className="review-discussion">
    {telegramChannel && <div className="review-author-channel"><span>Канал автора</span><a className="review-item-channel" href={`https://t.me/${telegramChannel}`} target="_blank" rel="noopener noreferrer" aria-label={`Telegram-канал автора @${telegramChannel} (откроется в новой вкладке)`}>
        <Image src="/brand/icons/telegram.svg" width={18} height={18} alt="" /><span>@{telegramChannel}</span>
      </a></div>}
    <div className="review-reactions">
      {reactionsEnabled && <button type="button" disabled={pending} aria-label={target === 'tierlist' ? 'Нравится тирлист' : 'Нравится отзыв'} aria-pressed={stats.vote===1} onClick={() => run('vote',stats.vote===1 ? 0 : 1)}><Thumb /><span>{stats.likes}</span></button>}
      {reactionsEnabled && <button type="button" disabled={pending} aria-label={target === 'tierlist' ? 'Не нравится тирлист' : 'Не нравится отзыв'} aria-pressed={stats.vote===-1} onClick={() => run('vote',stats.vote===-1 ? 0 : -1)}><Thumb down /><span>{stats.dislikes}</span></button>}
      {commentsEnabled && <button type="button" className="review-comments-toggle" aria-label={`Комментарии к ${target === 'tierlist' ? 'тирлисту' : 'отзыву'}: ${stats.comments}`} aria-expanded={open} aria-controls={regionId} onClick={() => { setOpen(!open); if (!open && !loaded) run('read'); }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true"><path d="M20 16a3 3 0 0 1-3 3H9l-5 3V6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v10Z" /></svg><span className="review-comments-label">Комментарии</span><span>{stats.comments}</span>
      </button>}
    </div>
    {error && <p className="field-error" role="alert">{error} {signIn && <Link href="/sign-in">Войти</Link>}</p>}
    {commentsEnabled && open && <section id={regionId} className="review-thread" aria-label={target === 'tierlist' ? 'Комментарии к тирлисту' : 'Комментарии к отзыву'} aria-busy={pending}>
      {stats.authenticated ? <form className="review-comment-composer" onSubmit={event => { event.preventDefault(); run('comment',text); }}>
        <label htmlFor={`${regionId}-text`}>Ваш комментарий</label><textarea id={`${regionId}-text`} value={text} onChange={event => setText(event.target.value)} maxLength={1000} required rows={3} placeholder={target === 'tierlist' ? 'Обсудить тирлист…' : 'Обсудить отзыв…'} disabled={pending} />
        <div><span>{text.length} / 1000</span><button className="community-button" type="submit" disabled={pending || !text.trim()}>{pending ? 'Подождите…' : 'Отправить'}</button></div>
      </form> : <p><Link href="/sign-in">Войдите</Link>, чтобы оставить комментарий.</p>}
      {!loaded ? <p role="status">{pending ? 'Загружаем комментарии…' : 'Комментарии не загружены.'} {!pending && <button type="button" onClick={() => run('read')}>Повторить</button>}</p> : !comments.length ? <p className="review-thread-empty">Комментариев пока нет. Начните обсуждение.</p> : <ul className="review-thread-list">{comments.map(comment => <li key={comment.id}>
        <div className="review-comment-avatar" aria-hidden="true">{comment.avatarId ? <Image unoptimized src={`/api/profile-images/${comment.avatarId}`} alt="" width={32} height={32} /> : (comment.name || comment.username || '?').charAt(0)}</div>
        <div className="review-comment-body"><header>{comment.username ? <Link href={`/profile/${comment.username}`}>{comment.name.includes('@') ? `@${comment.username}` : comment.name}</Link> : <strong>{comment.name.includes('@') ? 'Участник' : comment.name}</strong>}{comment.tag && <span className="profile-tag">{comment.tag}</span>}<time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleDateString('ru-RU')}</time></header><p>{comment.text}</p>{comment.canDelete && <button className="review-comment-delete" type="button" disabled={pending} onClick={() => { if(window.confirm('Удалить комментарий?')) run('delete',comment.id); }}>Удалить</button>}</div>
      </li>)}</ul>}
      {more && <button className="community-button community-button-secondary" type="button" disabled={pending} onClick={() => run('read',comments.at(-1)?.id,true)}>Ещё комментарии</button>}
    </section>}
  </footer>;
}
