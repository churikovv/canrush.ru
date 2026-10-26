'use client';
import { CoverImage } from '@/components/cover-image';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { swipeAction, undoSwipeAction } from '@/app/community/dating-actions';
import Link from '@/components/navigation-progress';
import type { DatingProgress, DatingRewards, SwipeCard } from '@/lib/drink-swipes';
import { pickReason } from '@/lib/pick-reason';

/** Past this many pixels a drag decides; below it the card springs back. */
const THRESHOLD = 110;
const price = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });

/**
 * The swipe deck: drag the top card (or use the buttons, or ← →) — right is «нравится», left «пропустить»;
 * «вернуть» brings the last card back. A guest can try it, but swipes are kept only after signing in.
 */
export function SwipeDeck({ cards, signedIn, rewards, progress: initialProgress }: { cards: SwipeCard[]; signedIn: boolean; rewards: DatingRewards; progress: DatingProgress | null }) {
  const router = useRouter();
  const [progress, setProgress] = useState(initialProgress);
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState(0);
  const [leaving, setLeaving] = useState<'like' | 'skip' | null>(null);
  const [history, setHistory] = useState<{ card: SwipeCard; liked: boolean }[]>([]);
  const [notice, setNotice] = useState<{ text: string; match?: boolean; signIn?: boolean; tag?: { key: string; label: string } } | null>(null);
  const [reward, setReward] = useState<{ xp: number; at: number } | null>(null);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const card = cards[index];

  useEffect(() => { if (!notice || notice.signIn) return; const timer = window.setTimeout(() => setNotice(null), notice.tag ? 4200 : 2600); return () => window.clearTimeout(timer); }, [notice]);
  useEffect(() => { if (!reward) return; const timer = window.setTimeout(() => setReward(null), 1200); return () => window.clearTimeout(timer); }, [reward]);

  function decide(liked: boolean) {
    if (!card || leaving) return;
    setLeaving(liked ? 'like' : 'skip');
    window.setTimeout(() => { setIndex(current => current + 1); setLeaving(null); setDrag(0); }, 260);
    setHistory(current => [...current, { card, liked }]);
    if (!signedIn) { setNotice({ text: 'Войдите, чтобы свайпы сохранялись и улучшали рекомендации', signIn: true }); return; }
    if (liked && card.reason?.kind === 'similar' && card.reason.fans >= 2) setNotice({ text: `Это мэтч! Нравится ${card.reason.fans} людям с похожим вкусом`, match: true });
    void swipeAction(card.brand, card.flavor, liked).then(result => {
      if (result.error) { setNotice({ text: result.error, signIn: result.signIn }); setHistory(current => current.slice(0, -1)); setIndex(current => Math.max(0, current - 1)); return; }
      setProgress(current => current && { swipes: current.swipes + 1, likes: current.likes + (liked ? 1 : 0), xpLeft: result.xp ? Math.max(0, current.xpLeft - 1) : current.xpLeft, hasTag: current.hasTag || Boolean(result.tag) });
      if (result.xp) setReward({ xp: result.xp, at: Date.now() });
      if (result.tag) setNotice({ text: 'Новый тег за свидание:', match: true, tag: result.tag });
    });
  }
  function undo() {
    const last = history.at(-1);
    if (!last || leaving) return;
    setHistory(current => current.slice(0, -1));
    setIndex(current => Math.max(0, current - 1));
    setDrag(0);
    if (!signedIn) return;
    void undoSwipeAction(last.card.brand, last.card.flavor);
    setProgress(current => current && { ...current, swipes: Math.max(0, current.swipes - 1), likes: Math.max(0, current.likes - (last.liked ? 1 : 0)) });
  }

  function onPointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (leaving || (event.target as Element).closest('a, button')) return;
    start.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function onPointerMove(event: ReactPointerEvent<HTMLElement>) {
    if (start.current?.id === event.pointerId) setDrag(event.clientX - start.current.x);
  }
  function onPointerUp(event: ReactPointerEvent<HTMLElement>) {
    if (start.current?.id !== event.pointerId) return;
    start.current = null;
    if (Math.abs(drag) > THRESHOLD) decide(drag > 0);
    else setDrag(0);
  }

  const offset = leaving === 'like' ? 640 : leaving === 'skip' ? -640 : drag;
  const style = { '--dx': `${offset}px`, '--rot': `${offset / 18}deg`, '--like': Math.max(0, Math.min(1, offset / THRESHOLD)), '--skip': Math.max(0, Math.min(1, -offset / THRESHOLD)) } as CSSProperties;
  return <section className="swipe" aria-label="Карточки напитков" tabIndex={0}
    onKeyDown={event => { if (event.key === 'ArrowRight') decide(true); if (event.key === 'ArrowLeft') decide(false); }}>
    <DatingRewardsIsland rewards={rewards} progress={progress} />
    <div className="swipe-stack" data-no-pull>
      {card ? cards.slice(index, index + 3).reverse().map((item, layer, shown) => {
        const top = layer === shown.length - 1;
        return <article key={`${item.brand}:${item.flavor}`} className={`swipe-card${top ? ' is-top' : ''}${top && leaving ? ' is-leaving' : ''}${top && !drag && !leaving ? ' is-resting' : ''}`}
          data-depth={shown.length - 1 - layer} style={top ? style : undefined} aria-hidden={top ? undefined : true}
          onPointerDown={top ? onPointerDown : undefined} onPointerMove={top ? onPointerMove : undefined} onPointerUp={top ? onPointerUp : undefined}
          onPointerCancel={top ? () => { start.current = null; setDrag(0); } : undefined}>
          <span className="swipe-stamp is-like" aria-hidden="true">Нравится</span>
          <span className="swipe-stamp is-skip" aria-hidden="true">Пропуск</span>
          <span className="swipe-cover"><CoverImage src={item.cover} width={360} height={360} sizes="(max-width: 639px) 70vw, 300px" alt="" draggable={false} priority={top} /></span>
          <div className="swipe-copy">
            <small>{item.brand}</small>
            <h2>{item.name}</h2>
            <p className="swipe-facts">
              {item.minPrice !== null && <span className="is-price">от {price.format(item.minPrice)} ₽</span>}
              {item.taste !== null && <span>★ {item.taste.toLocaleString('ru-RU')} · {item.reviews}</span>}
              {item.likes > 0 && <span>♥ {item.likes}</span>}
            </p>
            {item.reason && <p className="swipe-reason">{pickReason(item.reason)}</p>}
            {top && <Link className="swipe-more" href={item.href}>Подробнее о напитке</Link>}
          </div>
        </article>;
      }) : <div className="swipe-empty">
        <strong>На сегодня всё</strong>
        <p>Ты посмотрел все карточки. Завтра колода перемешается, а новые напитки из каталога появятся здесь.</p>
        <button type="button" className="community-button" onClick={() => { setIndex(0); setHistory([]); router.refresh(); }}>Обновить колоду</button>
      </div>}
      {notice && <p className={`swipe-notice${notice.match ? ' is-match' : ''}`} role="status">
        {notice.text}{notice.tag && <> <span className="profile-tag" data-tag={notice.tag.key}>{notice.tag.label}</span> · +20 XP</>}{notice.signIn && <> · <Link href="/sign-in">Войти</Link></>}
      </p>}
      {reward && <span key={reward.at} className="swipe-xp" aria-live="polite">+{reward.xp} XP</span>}
    </div>
    <div className="swipe-actions">
      <button type="button" className="swipe-button is-skip" aria-label="Пропустить" title="Пропустить (←)" disabled={!card} onClick={() => decide(false)}>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
      <button type="button" className="swipe-button is-undo" aria-label="Вернуть последнюю карточку" title="Вернуть" disabled={!history.length} onClick={undo}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>
      </button>
      <button type="button" className="swipe-button is-like" aria-label="Нравится" title="Нравится (→)" disabled={!card} onClick={() => decide(true)}>
        <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 21s-7.5-4.6-9.6-9.3C.9 8.2 3 4.5 6.6 4.5c2.1 0 3.6 1.2 4.4 2.5.8-1.3 2.3-2.5 4.4-2.5 3.6 0 5.7 3.7 4.2 7.2C19.5 16.4 12 21 12 21Z" /></svg>
      </button>
    </div>
  </section>;
}

/** XP for the first swipes and the way to «Люблю <3»; counts follow the swipes made on this page. */
function DatingRewardsIsland({ rewards, progress }: { rewards: DatingRewards; progress: DatingProgress | null }) {
  const xpDone = progress ? rewards.xpLimit - progress.xpLeft : 0;
  const swipes = Math.min(progress?.swipes ?? 0, rewards.swipeGoal), likes = Math.min(progress?.likes ?? 0, rewards.likeGoal);
  const showXp = !progress || progress.xpLeft > 0, showTag = !progress?.hasTag;
  if (!showXp && !showTag) return null;
  return <div className="dating-rewards" role="group" aria-label="Награды за свайпы">
    {showXp && <div className="dating-reward is-xp">
      <span className="dating-reward-title"><span className="dating-reward-icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M13.5 2 4 14h6.5L9.5 22 20 9.5h-6.6L13.5 2Z" /></svg></span>+{rewards.xp} XP за свайп</span>
      <small>{progress ? `${xpDone} из ${rewards.xpLimit} свайпов` : `${rewards.xpLimit} свайпов после входа`}</small>
      <span className="dating-reward-bar" aria-hidden="true"><span style={{ width: `${xpDone / rewards.xpLimit * 100}%` }} /></span>
    </div>}
    {showTag && <div className="dating-reward is-tag">
      <span className="dating-reward-title"><span className="profile-tag" data-tag={rewards.tag.key} title="Тег за свидание">{rewards.tag.label}</span></span>
      <small aria-label={`Свайпы ${swipes} из ${rewards.swipeGoal}, мэтчи ${likes} из ${rewards.likeGoal}`}>{swipes}/{rewards.swipeGoal} свайпов · {likes}/{rewards.likeGoal} ♥</small>
      <span className="dating-reward-bar" aria-hidden="true"><span style={{ width: `${(swipes + likes) / (rewards.swipeGoal + rewards.likeGoal) * 100}%` }} /></span>
    </div>}
  </div>;
}
