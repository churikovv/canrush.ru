'use client';
import { MediaAttachButton, MediaAttachmentPreviews, useMediaAttachments } from '@/components/media-attachments';
import { MentionText } from '@/components/mention-text';
import { ReviewPhotoGallery } from '@/components/review-photo-gallery';
import { MentionTextarea } from '@/components/mention-textarea';
import { profileTagKey } from '@/lib/profile-achievements';
import Link from '@/components/navigation-progress';
import Image from 'next/image';
import { useId, useRef, useState, useTransition } from 'react';
import { wallCommentLikeAction, wallDiscussionAction } from '@/app/profile/wall-discussion-actions';
import { EditIcon, TrashIcon } from '@/components/action-icons';
import { tierDiscussionAction } from '@/app/tierlists/discussion-actions';
import { reviewDiscussionAction } from '@/app/catalog/discussion-actions';
import type { ReviewCommentData, ReviewInteraction } from '@/lib/review-discussions';
import type { WallCommentData } from '@/lib/wall-discussions';

/** Wall comments also carry likes; review and tier list comments do not. */
type Comment = ReviewCommentData & Partial<Pick<WallCommentData, 'likes' | 'liked'>>;

function Thumb({ down = false }: { down?: boolean }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={down ? { transform: 'rotate(180deg)' } : undefined}><path d="M7 10v11H3V10h4Zm0 0 5-8c3 0 3 3 2 7h5a2 2 0 0 1 2 2l-2 8a2 2 0 0 1-2 2H7" /></svg>;
}
function authorLabel(comment: Pick<Comment, 'name' | 'username'>): string {
  return comment.username ? `@${comment.username}` : comment.name.includes('@') ? 'Участник' : comment.name;
}
export function ReviewDiscussion({ reviewId, initial, telegramChannel, target = 'review', reactionsEnabled = true, commentsEnabled = true }: { reviewId: string; initial?: ReviewInteraction; telegramChannel?: string | null; target?: 'review' | 'tierlist' | 'wall'; reactionsEnabled?: boolean; commentsEnabled?: boolean }) {
  const [stats,setStats] = useState(initial ?? { likes: 0, dislikes: 0, comments: 0, vote: 0, authenticated: false });
  const [open,setOpen] = useState(false);
  const [loaded,setLoaded] = useState(false);
  const [comments,setComments] = useState<Comment[]>([]);
  const [liking,setLiking] = useState<string | null>(null);
  const [editing,setEditing] = useState<string | null>(null);
  const [draft,setDraft] = useState('');
  const [replyTo,setReplyTo] = useState<{ id: string; label: string } | null>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const [more,setMore] = useState(false);
  const [text,setText] = useState('');
  const media = useMediaAttachments('комментарию');
  const [error,setError] = useState('');
  const [signIn,setSignIn] = useState(false);
  const [pending,startTransition] = useTransition();
  const regionId = useId();
  function run(action: 'read' | 'vote' | 'comment' | 'delete' | 'edit', value?: string | number | FormData | { commentId: string; text: string } | { text: string; replyToId: string }, append = false) {
    setError(''); setSignIn(false);
    startTransition(async () => {
      try {
        const result = await (target === 'wall' ? wallDiscussionAction : target === 'tierlist' ? tierDiscussionAction : reviewDiscussionAction)(reviewId, action, value);
        if (result.error) { setError(result.error); setSignIn(Boolean(result.signIn)); return; }
        if (result.interaction) setStats(result.interaction);
        if (result.thread) { setComments(previous => append ? [...previous,...result.thread!.items.filter(item => !previous.some(old => old.id === item.id))] : result.thread!.items); setMore(result.thread.hasMore); setLoaded(true); }
        if (action === 'comment') { setText(''); setReplyTo(null); media.clear(); }
        const edited = result.edited;
        if (edited) { setComments(previous => previous.map(item => item.id === edited.id ? { ...item, text: edited.text, editedAt: edited.editedAt } : item)); setEditing(null); }
      } catch { setError('Нет связи с сервером. Попробуйте ещё раз.'); }
    });
  }
  async function toggleLike(comment: Comment) {
    if (liking) return;
    const liked = !comment.liked;
    const patch = (values: Pick<Comment, 'likes' | 'liked'>) => setComments(previous => previous.map(item => item.id === comment.id ? { ...item, ...values } : item));
    setError(''); setSignIn(false); setLiking(comment.id);
    patch({ liked, likes: (comment.likes ?? 0) + (liked ? 1 : -1) });
    try {
      const result = await wallCommentLikeAction(reviewId, comment.id, liked);
      if (result.error) { patch({ liked: comment.liked, likes: comment.likes }); setError(result.error); setSignIn(Boolean(result.signIn)); }
      else patch({ liked: result.liked, likes: result.likes });
    } catch { patch({ liked: comment.liked, likes: comment.likes }); setError('Нет связи с сервером. Попробуйте ещё раз.'); }
    finally { setLiking(null); }
  }
  /** Plain comments go as JSON; with attachments the comment is sent as a form so files reach the server action. */
  function submitComment() {
    if (!media.files.length) { run('comment', replyTo ? { text, replyToId: replyTo.id } : text); return; }
    const form = new FormData();
    form.set('text', text);
    if (replyTo) form.set('replyToId', replyTo.id);
    media.appendTo(form);
    run('comment', form);
  }
  function answer(comment: Comment) {
    setReplyTo({ id: comment.id, label: authorLabel(comment) });
    composer.current?.focus({ preventScroll: true });
    composer.current?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
  return <footer className="review-discussion">
    {telegramChannel && <div className="review-author-channel"><span>Канал автора</span><a className="review-item-channel" href={`https://t.me/${telegramChannel}`} target="_blank" rel="noopener noreferrer" aria-label={`Telegram-канал автора @${telegramChannel} (откроется в новой вкладке)`}>
        <Image src="/brand/icons/telegram.svg" width={18} height={18} alt="" /><span>@{telegramChannel}</span>
      </a></div>}
    <div className="review-reactions">
      {reactionsEnabled && <button type="button" disabled={pending} aria-label={target === 'wall' ? 'Нравится запись' : target === 'tierlist' ? 'Нравится тирлист' : 'Нравится отзыв'} aria-pressed={stats.vote===1} onClick={() => run('vote',stats.vote===1 ? 0 : 1)}><Thumb /><span>{stats.likes}</span></button>}
      {reactionsEnabled && <button type="button" disabled={pending} aria-label={target === 'wall' ? 'Не нравится запись' : target === 'tierlist' ? 'Не нравится тирлист' : 'Не нравится отзыв'} aria-pressed={stats.vote===-1} onClick={() => run('vote',stats.vote===-1 ? 0 : -1)}><Thumb down /><span>{stats.dislikes}</span></button>}
      {commentsEnabled && <button type="button" className="review-comments-toggle" aria-label={`Комментарии к ${target === 'wall' ? 'записи' : target === 'tierlist' ? 'тирлисту' : 'отзыву'}: ${stats.comments}`} aria-expanded={open} aria-controls={regionId} onClick={() => { setOpen(!open); if (!open && !loaded) run('read'); }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true"><path d="M20 16a3 3 0 0 1-3 3H9l-5 3V6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v10Z" /></svg><span className="review-comments-label">Комментарии</span><span>{stats.comments}</span>
      </button>}
    </div>
    {error && <p className="field-error" role="alert">{error} {signIn && <Link href="/sign-in">Войти</Link>}</p>}
    {commentsEnabled && open && <section id={regionId} className="review-thread" aria-label={target === 'wall' ? 'Комментарии к записи' : target === 'tierlist' ? 'Комментарии к тирлисту' : 'Комментарии к отзыву'} aria-busy={pending}>
      {stats.authenticated ? <form className="review-comment-composer" onSubmit={event => { event.preventDefault(); submitComment(); }}>
        <label htmlFor={`${regionId}-text`}>{replyTo ? 'Ваш ответ' : 'Ваш комментарий'}</label>
        {replyTo && <div className="review-reply-target"><span>Ответ <b>{replyTo.label}</b></span><button type="button" aria-label="Отменить ответ" title="Отменить ответ" onClick={() => setReplyTo(null)}>×</button></div>}
        <MentionTextarea ref={composer} id={`${regionId}-text`} value={text} onValueChange={setText} onPaste={media.onPaste} maxLength={1000} required rows={3} placeholder={target === 'wall' ? 'Обсудить запись…' : target === 'tierlist' ? 'Обсудить тирлист…' : 'Обсудить отзыв…'} disabled={pending} />
        {media.error && <p role="alert" className="field-error">{media.error}</p>}
        <MediaAttachmentPreviews media={media} />
        <div><MediaAttachButton media={media} label="Добавить к комментарию фото, GIF или видео" /><span>{media.preparing ? 'Готовим видео…' : `${text.length} / 1000`}</span><button className="community-button" type="submit" disabled={pending || !text.trim() || media.preparing}>{pending ? 'Подождите…' : 'Отправить'}</button></div>
      </form> : <p><Link href="/sign-in">Войдите</Link>, чтобы оставить комментарий.</p>}
      {!loaded ? <p role="status">{pending ? 'Загружаем комментарии…' : 'Комментарии не загружены.'} {!pending && <button type="button" onClick={() => run('read')}>Повторить</button>}</p> : !comments.length ? <p className="review-thread-empty">Комментариев пока нет. Начните обсуждение.</p> : <ul className="review-thread-list">{comments.map(comment => <li key={comment.id}>
        <div className="review-comment-avatar" aria-hidden="true">{comment.avatarId ? <Image unoptimized src={`/api/profile-images/${comment.avatarId}`} alt="" width={32} height={32} /> : (comment.name || comment.username || '?').charAt(0)}</div>
        <div className="review-comment-body"><header>{comment.username ? <Link href={`/profile/${comment.username}`}>{comment.name.includes('@') ? `@${comment.username}` : comment.name}</Link> : <strong>{comment.name.includes('@') ? 'Участник' : comment.name}</strong>}{comment.tag && <span className="profile-tag" data-tag={profileTagKey(comment.tag)}>{comment.tag}</span>}<time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleDateString('ru-RU')}</time>{comment.editedAt && <span className="review-comment-edited" title={`Изменено ${new Date(comment.editedAt).toLocaleString('ru-RU')}`}>изменено</span>}
          {comment.canDelete && <span className="review-comment-actions">
            {editing !== comment.id && <button className="review-comment-action" type="button" disabled={pending} aria-label="Редактировать комментарий" title="Редактировать комментарий" onClick={() => { setEditing(comment.id); setDraft(comment.text); setError(''); }}><EditIcon size={16} /></button>}
            <button className="review-comment-action review-comment-delete" type="button" disabled={pending} aria-label="Удалить комментарий" title="Удалить комментарий" onClick={() => { if(window.confirm('Удалить комментарий?')) run('delete',comment.id); }}><TrashIcon size={16} /></button>
          </span>}</header>
        {editing === comment.id ? <form className="review-comment-edit" onSubmit={event => { event.preventDefault(); run('edit', { commentId: comment.id, text: draft }); }}>
          <label htmlFor={`${regionId}-edit-${comment.id}`} className="sr-only">Текст комментария</label>
          <MentionTextarea id={`${regionId}-edit-${comment.id}`} value={draft} onValueChange={setDraft} maxLength={1000} rows={2} required autoFocus disabled={pending} onKeyDown={event => { if (event.key === 'Escape') setEditing(null); }} />
          <div><span>{draft.length} / 1000</span><button className="community-button community-button-secondary" type="button" disabled={pending} onClick={() => setEditing(null)}>Отмена</button><button className="community-button" type="submit" disabled={pending || !draft.trim() || draft.trim() === comment.text}>{pending ? 'Сохраняем…' : 'Сохранить'}</button></div>
        </form> : <p>{comment.replyTo && <>{comment.replyTo.username ? <Link className="review-reply-mention" href={`/profile/${comment.replyTo.username}`}>@{comment.replyTo.username}</Link> : <span className="review-reply-mention">{comment.replyTo.name.includes('@') ? 'Участник' : comment.replyTo.name}</span>}{' '}</>}<MentionText text={comment.text} /></p>}
        {editing !== comment.id && comment.media?.length ? <ReviewPhotoGallery photos={comment.media.map(item => item.id)} kinds={comment.media.map(item => item.kind)} source="comment-media" /> : null}
        <div className="review-comment-footer">{typeof comment.likes === 'number' && <button className="review-comment-like" type="button" aria-pressed={Boolean(comment.liked)} aria-label={comment.canDelete ? `Лайков: ${comment.likes}` : comment.liked ? `Убрать лайк, лайков: ${comment.likes}` : `Нравится комментарий, лайков: ${comment.likes}`} disabled={comment.canDelete || liking === comment.id} onClick={() => void toggleLike(comment)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill={comment.liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true"><path d="M12 20.5 4.6 13.3A4.6 4.6 0 0 1 11.1 6.8l.9.9.9-.9a4.6 4.6 0 0 1 6.5 6.5L12 20.5Z" /></svg><span>{comment.likes}</span>
        </button>}
        {stats.authenticated && !comment.canDelete && <button className="review-comment-reply" type="button" disabled={pending} aria-label={`Ответить ${authorLabel(comment)}`} onClick={() => answer(comment)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg><span>Ответить</span>
        </button>}</div></div>
      </li>)}</ul>}
      {more && <button className="community-button community-button-secondary" type="button" disabled={pending} onClick={() => run('read',comments.at(-1)?.id,true)}>Ещё комментарии</button>}
    </section>}
  </footer>;
}
