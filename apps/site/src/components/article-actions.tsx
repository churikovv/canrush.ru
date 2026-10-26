'use client';
import { useActionState, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteArticleAction, deleteDraftAction, likeArticleAction, moderateArticleAction, reopenArticleAction } from '@/app/news/actions';
import { ActionToast } from '@/components/action-toast';
import { FormAlert } from '@/components/form-alert';

/** The team publishes a pending article or returns it with a reason the author sees in the editor. */
export function ArticleModeration({ id, version }: { id: string; version: string }) {
  const [state, action, pending] = useActionState(moderateArticleAction.bind(null, id, version), {});
  if (state.done) return <FormAlert tone="success">Решение сохранено.</FormAlert>;
  return <form action={action} className="article-moderation">
    <strong>Модерация</strong>
    <label>Комментарий автору<textarea name="note" maxLength={500} rows={2} disabled={pending} placeholder="Что поправить перед публикацией" /></label>
    {state.error && <FormAlert>{state.error}</FormAlert>}
    <div className="article-moderation-actions">
      <button className="community-button" name="status" value="published" disabled={pending}>Опубликовать</button>
      <button className="community-button community-button-secondary" name="status" value="rejected" disabled={pending}>Вернуть на доработку</button>
    </div>
  </form>;
}

/**
 * The author's buttons under their article: back to drafts (a pending one leaves the queue, a published one hides until
 * it passes review again) and delete; the team only deletes. Both ask once more before acting.
 */
export function ArticleOwnerActions({ id, status, own }: { id: string; status: string; own: boolean }) {
  const [confirm, setConfirm] = useState<'reopen' | 'delete' | null>(null);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const run = (what: 'reopen' | 'delete') => start(async () => {
    setError('');
    const result = what === 'reopen' ? await reopenArticleAction(id) : await deleteArticleAction(id);
    if (result?.error) setError(result.error);
  });
  return <div className="article-owner-actions">
    {confirm ? <div className="article-confirm" role="alertdialog" aria-label="Подтверждение">
      <p>{confirm === 'delete' ? 'Удалить статью насовсем? Вернуть её не получится.' : status === 'published'
        ? 'Статья скроется из «Новостей», пока снова не пройдёт проверку. Вернуть в черновики?' : 'Статья уйдёт из очереди на проверку. Вернуть в черновики?'}</p>
      <div>
        <button type="button" className={`community-button${confirm === 'delete' ? ' is-danger' : ''}`} disabled={pending} onClick={() => run(confirm)}>{pending ? 'Минуту…' : confirm === 'delete' ? 'Удалить' : 'Вернуть'}</button>
        <button type="button" className="community-button community-button-secondary" disabled={pending} onClick={() => setConfirm(null)}>Отмена</button>
      </div>
    </div> : <div className="article-owner-buttons">
      {own && (status === 'pending' || status === 'published') && <button type="button" className="community-button community-button-secondary" onClick={() => setConfirm('reopen')}>Редактировать</button>}
      <button type="button" className="community-button community-button-secondary is-danger" onClick={() => setConfirm('delete')}>Удалить</button>
    </div>}
    {error && <FormAlert>{error}</FormAlert>}
  </div>;
}

const heart = (filled: boolean) => <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={filled ? 0 : 1.8} strokeLinejoin="round" d="M12 21s-7.5-4.6-9.6-9.3C.9 8.2 3 4.5 6.6 4.5c2.1 0 3.6 1.2 4.4 2.5.8-1.3 2.3-2.5 4.4-2.5 3.6 0 5.7 3.7 4.2 7.2C19.5 16.4 12 21 12 21Z" /></svg>;

/** A like of a published article: optimistic, rolled back on a refusal; guests go to sign-in, the author sees the count. */
export function ArticleLikeButton({ id, likes, liked, own, signedIn }: { id: string; likes: number; liked: boolean; own: boolean; signedIn: boolean }) {
  const router = useRouter();
  const [state, setState] = useState({ likes, liked });
  const [pending, start] = useTransition();
  // One's own article: just the count, not a button-looking pill, so it does not seem broken when tapped.
  if (own) return <span className="article-like is-own" aria-label={`Лайки: ${state.likes}`} title="Свою статью лайкнуть нельзя">{heart(state.likes > 0)}{state.likes}</span>;
  function toggle() {
    if (!signedIn) { router.push(`/sign-in?callbackURL=/news/${id}`); return; }
    const previous = state;
    setState({ liked: !state.liked, likes: state.likes + (state.liked ? -1 : 1) });
    start(async () => {
      const result = await likeArticleAction(id, !previous.liked).catch(() => ({ error: 'Нет связи с сервером.' } as { likes?: number; liked?: boolean; error?: string }));
      if (result.error || result.likes === undefined) setState(previous); else setState({ likes: result.likes, liked: result.liked === true });
    });
  }
  return <button type="button" className="article-like" aria-pressed={state.liked} disabled={pending}
    aria-label={`${state.liked ? 'Убрать лайк' : 'Поставить лайк'}. Лайки: ${state.likes}`} onClick={toggle}>{heart(state.liked)}{state.likes}</button>;
}

/** «Удалить» on one's own draft in the list; the page stays and the list updates. */
export function ArticleDraftDelete({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return <button type="button" className="article-draft-delete" disabled={pending} onClick={() => {
    if (!window.confirm('Удалить черновик? Вернуть его не получится.')) return;
    start(async () => { const result = await deleteDraftAction(id); if (result.error) window.alert(result.error); else router.refresh(); });
  }}>{pending ? 'Удаляем…' : 'Удалить'}</button>;
}

/** After «Опубликовать»: the toast says the article waits for review. */
export function ArticleSentToast() {
  const [trigger] = useState(() => ({}));
  const [shown, setShown] = useState<object>({});
  useEffect(() => {
    // Shown once: a reload of the page does not repeat it.
    const timer = window.setTimeout(() => { setShown(trigger); window.history.replaceState(null, '', window.location.pathname); }, 100);
    return () => clearTimeout(timer);
  }, [trigger]);
  return <ActionToast message="Статья отправлена: опубликуем после модерации" trigger={shown} />;
}
