'use client';
import { CoverImage } from '@/components/cover-image';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { favoriteSwipedAction, peopleCardAction, personDecisionAction, swipeAction, undoSwipeAction } from '@/app/community/dating-actions';
import Link from '@/components/navigation-progress';
import type { DatingProgress, DatingRewards, SwipeCard } from '@/lib/drink-swipes';
import type { PersonSuggestion } from '@/lib/people-suggestions';
import { pluralRu } from '@/lib/drink-calendar-fields';
import { pickReason } from '@/lib/pick-reason';
import { TasteEnd } from '@/components/taste-card';
import { ProfileTag } from '@/components/profile-tag';
import { AvatarFrame } from '@/components/avatar-frame';
import { LevelChip } from '@/components/level-badge';
import { VerifiedMark } from '@/components/verified-mark';
import { profileTagLabel } from '@/lib/profile-achievements';

/** Past this many pixels a drag decides; below it the card springs back. */
const THRESHOLD = 110;
const price = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });

/** The deck holds drinks and, now and then, a person: right follows them, left skips. */
type DeckItem = { kind: 'drink'; card: SwipeCard } | { kind: 'person'; person: PersonSuggestion };
type Decision = { kind: 'drink'; card: SwipeCard; liked: boolean } | { kind: 'person'; person: PersonSuggestion; followed: boolean };
const itemKey = (item: DeckItem) => (item.kind === 'drink' ? `${item.card.brand}:${item.card.flavor}` : `person:${item.person.id}`);
const STAR = <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m12 2.8 2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9L12 2.8Z" /></svg>;
const HEART = <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.3-8.9-8.6C1.7 8.1 3.7 4.8 6.9 4.8c1.9 0 3.3 1.1 4.1 2.3.8-1.2 2.2-2.3 4.1-2.3 3.2 0 5.2 3.3 3.8 6.6C17 15.7 12 20 12 20Z" /></svg>;
const INFO = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.6v.1" /></svg>;
const PERSON = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></svg>;
const CROSS = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>;
const likes = (count: number) => `${count} ${pluralRu(count, 'общий лайк', 'общих лайка', 'общих лайков')}`;

/**
 * The swipe deck: drag the top card (or use the buttons, or ← →) — right is «нравится», left «пропустить»;
 * «вернуть» brings the last card back. A guest can try it, but swipes are kept only after signing in.
 */
export function SwipeDeck({ cards, signedIn, rewards, progress: initialProgress, peopleAt = [], reviewXp = 25 }: {
  cards: SwipeCard[]; signedIn: boolean; rewards: DatingRewards; progress: DatingProgress | null; peopleAt?: readonly number[];
  /** XP a review of a drink gives (`XP_SOURCES`, from the server): «Оценить» shows it. */
  reviewXp?: number;
}) {
  const router = useRouter();
  const [progress, setProgress] = useState(initialProgress);
  const [items, setItems] = useState<DeckItem[]>(() => cards.map(card => ({ kind: 'drink', card })));
  // «Обновить колоду» refreshes the page: a different set of drinks from the server starts a new deck. Compared by
  // content, so a re-render with the same drinks never throws away the swipes and people cards of this visit.
  const deal = cards.map(card => `${card.brand}\u0000${card.flavor}`).join('\n');
  const [dealt, setDealt] = useState(deal);
  if (dealt !== deal) { setDealt(deal); setItems(cards.map(card => ({ kind: 'drink', card }))); }
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState(0);
  const [leaving, setLeaving] = useState<'like' | 'skip' | null>(null);
  const [history, setHistory] = useState<Decision[]>([]);
  const [notice, setNotice] = useState<{ text: string; match?: boolean; signIn?: boolean; tag?: { key: string; label: string } } | null>(null);
  const [reward, setReward] = useState<{ xp: number; at: number } | null>(null);
  // The drink swiped last, with its two next steps: a review, and (after «нравится») the favourites.
  const [after, setAfter] = useState<{ card: SwipeCard; liked: boolean; favorite: 'off' | 'saving' | 'on' } | null>(null);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const indexRef = useRef(0);
  const shownPeople = useRef<string[]>([]);
  const item = items[index];
  useEffect(() => { indexRef.current = index; }, [index]);

  useEffect(() => { if (!notice || notice.signIn) return; const timer = window.setTimeout(() => setNotice(null), notice.tag ? 4200 : 2600); return () => window.clearTimeout(timer); }, [notice]);
  useEffect(() => { if (!reward) return; const timer = window.setTimeout(() => setReward(null), 1200); return () => window.clearTimeout(timer); }, [reward]);

  /** A person card goes right after the card on top, once the swipes of this visit reach the next mark. */
  function offerPerson() {
    void peopleCardAction(shownPeople.current).then(result => {
      const person = 'people' in result ? result.people[0] : undefined;
      if (!person || shownPeople.current.includes(person.id)) return;
      shownPeople.current = [...shownPeople.current, person.id];
      setItems(current => { const at = Math.min(current.length, indexRef.current + 1); return [...current.slice(0, at), { kind: 'person', person }, ...current.slice(at)]; });
    });
  }

  function decidePerson(person: PersonSuggestion, follow: boolean) {
    setHistory(current => [...current, { kind: 'person', person, followed: follow }]);
    if (follow) setNotice({ text: `Вы подписались на @${person.username}`, match: true });
    void personDecisionAction(person.id, follow ? 'follow' : 'skip').then(result => {
      if (!result.error) return;
      setNotice({ text: result.error });
      setHistory(current => current.slice(0, -1));
      setIndex(current => Math.max(0, current - 1));
    });
  }

  function decide(liked: boolean) {
    if (!item || leaving) return;
    setLeaving(liked ? 'like' : 'skip');
    window.setTimeout(() => { setIndex(current => current + 1); setLeaving(null); setDrag(0); }, 260);
    if (item.kind === 'person') { decidePerson(item.person, liked); return; }
    const card = item.card;
    setHistory(current => [...current, { kind: 'drink', card, liked }]);
    if (!signedIn) { setNotice({ text: 'Войдите, чтобы свайпы сохранялись и улучшали рекомендации', signIn: true }); return; }
    setAfter({ card, liked, favorite: 'off' });
    if (peopleAt.includes(history.filter(entry => entry.kind === 'drink').length + 1)) offerPerson();
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
    if (last.kind === 'person') { void personDecisionAction(last.person.id, last.followed ? 'unfollow' : 'unskip'); return; }
    if (after?.card === last.card) setAfter(null);
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

  function favorite() {
    if (!after || after.favorite === 'saving') return;
    const on = after.favorite === 'off';
    const swiped = after.card;
    setAfter(current => current && current.card === swiped ? { ...current, favorite: 'saving' } : current);
    void favoriteSwipedAction(swiped.brand, swiped.flavor, on).then(result => {
      if (result.error) setNotice({ text: result.error });
      setAfter(current => current && current.card === swiped ? { ...current, favorite: result.error ? (on ? 'off' : 'on') : on ? 'on' : 'off' } : current);
    });
  }

  function more() { setIndex(0); setHistory([]); setAfter(null); router.refresh(); }

  // The end of the deck, signed in: «Твой вкус» and someone with a similar taste instead of the empty stack.
  if (!item && signedIn) return <section className="swipe" aria-label="Твой вкус">
    <DatingRewardsIsland rewards={rewards} progress={progress} />
    <TasteEnd key={history.length} onMore={more} />
  </section>;

  const offset = leaving === 'like' ? 640 : leaving === 'skip' ? -640 : drag;
  const style = { '--dx': `${offset}px`, '--rot': `${offset / 18}deg`, '--like': Math.max(0, Math.min(1, offset / THRESHOLD)), '--skip': Math.max(0, Math.min(1, -offset / THRESHOLD)) } as CSSProperties;
  const person = item?.kind === 'person';
  return <section className={`swipe${signedIn ? ' has-after' : ''}`} aria-label="Карточки напитков" tabIndex={0}
    onKeyDown={event => { if (event.key === 'ArrowRight') decide(true); if (event.key === 'ArrowLeft') decide(false); }}>
    <DatingRewardsIsland rewards={rewards} progress={progress} />
    <div className="swipe-stack" data-no-pull>
      {item ? items.slice(index, index + 3).reverse().map((entry, layer, shown) => {
        const top = layer === shown.length - 1;
        const props = {
          className: `swipe-card${entry.kind === 'person' ? ' is-person' : ''}${top ? ' is-top' : ''}${top && leaving ? ' is-leaving' : ''}${top && !drag && !leaving ? ' is-resting' : ''}`,
          'data-depth': shown.length - 1 - layer, style: top ? style : undefined, 'aria-hidden': top ? undefined : true,
          onPointerDown: top ? onPointerDown : undefined, onPointerMove: top ? onPointerMove : undefined, onPointerUp: top ? onPointerUp : undefined,
          onPointerCancel: top ? () => { start.current = null; setDrag(0); } : undefined,
        } as const;
        if (entry.kind === 'person') return <article key={itemKey(entry)} {...props}>
          <span className="swipe-stamp is-like" aria-hidden="true">Подписаться</span>
          <span className="swipe-stamp is-skip" aria-hidden="true">Пропуск</span>
          <PersonCard person={entry.person} top={top} />
        </article>;
        const item = entry.card;
        return <article key={itemKey(entry)} {...props}>
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
            {top && <Link className="swipe-more" href={item.href}>{INFO}О напитке</Link>}
          </div>
        </article>;
      }) : <div className="swipe-empty">
        <strong>На сегодня всё</strong>
        <p>Ты посмотрел все карточки. Завтра колода перемешается, а новые напитки из каталога появятся здесь.</p>
        <button type="button" className="community-button" onClick={more}>Обновить колоду</button>
      </div>}
      {notice && <p className={`swipe-notice${notice.match ? ' is-match' : ''}`} role="status">
        {notice.text}{notice.tag && <> <ProfileTag tag={notice.tag.key}>{notice.tag.label}</ProfileTag> · +20 XP</>}{notice.signIn && <> · <Link href="/sign-in">Войти</Link></>}
      </p>}
      {reward && <span key={reward.at} className="swipe-xp" aria-live="polite">+{reward.xp} XP</span>}
    </div>
    <div className="swipe-actions">
      <button type="button" className="swipe-button is-skip" aria-label="Пропустить" title="Пропустить (←)" disabled={!item} onClick={() => decide(false)}>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
      <button type="button" className="swipe-button is-undo" aria-label="Вернуть последнюю карточку" title="Вернуть" disabled={!history.length} onClick={undo}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>
      </button>
      <button type="button" className="swipe-button is-like" aria-label={person ? 'Подписаться' : 'Нравится'} title={person ? 'Подписаться (→)' : 'Нравится (→)'} disabled={!item} onClick={() => decide(true)}>
        {person
          ? <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><circle cx="10" cy="8" r="4" /><path d="M3 20a7 7 0 0 1 14 0M19 8v6M16 11h6" /></svg>
          : <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 21s-7.5-4.6-9.6-9.3C.9 8.2 3 4.5 6.6 4.5c2.1 0 3.6 1.2 4.4 2.5.8-1.3 2.3-2.5 4.4-2.5 3.6 0 5.7 3.7 4.2 7.2C19.5 16.4 12 21 12 21Z" /></svg>}
      </button>
    </div>
    {signedIn && <AfterSwipe after={after} onFavorite={favorite} reviewXp={reviewXp} />}
  </section>;
}

/**
 * A person between the drinks, like a small profile: their banner (or the brand gradient), the framed avatar with the
 * level, name, nick and tag, their description, why they are offered, the drinks both like fanned out, and the counts.
 */
function PersonCard({ person, top }: { person: PersonSuggestion; top: boolean }) {
  const reason = person.reason;
  const name = person.name && person.name !== person.username ? person.name : person.username;
  return <>
    <span className="swipe-person-banner" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- a stored banner served by our own route */}
      {person.bannerId && <img src={`/api/profile-images/${person.bannerId}`} alt="" draggable={false} />}
    </span>
    <span className="swipe-person-avatar" data-frame={person.frame}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a stored avatar served by our own route */}
      {person.avatarId ? <img src={`/api/profile-images/${person.avatarId}`} alt="" width={112} height={112} draggable={false} /> : <b aria-hidden="true">{person.username.slice(0, 1).toUpperCase()}</b>}
      <AvatarFrame frame={person.frame} />
      <span className="swipe-person-level"><LevelChip level={person.level} /></span>
    </span>
    <div className="swipe-person-body">
      <span className={`swipe-person-reason is-${reason.kind}`}>
        {reason.kind === 'taste'
          ? <><svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 21s-7.5-4.6-9.6-9.3C.9 8.2 3 4.5 6.6 4.5c2.1 0 3.6 1.2 4.4 2.5.8-1.3 2.3-2.5 4.4-2.5 3.6 0 5.7 3.7 4.2 7.2C19.5 16.4 12 21 12 21Z" /></svg>Похожий вкус · {likes(reason.shared)}</>
          : <><svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13.5 2 4 14h6.5L9.5 22 20 9.5h-6.6L13.5 2Z" /></svg>Активно пишет отзывы</>}
      </span>
      <h2>{name}{person.verified && <VerifiedMark />}</h2>
      <p className="swipe-person-handle"><span>@{person.username}</span>{person.tag && <ProfileTag tag={person.tag}>{profileTagLabel(person.tag)}</ProfileTag>}</p>
      {person.bio && <p className="swipe-person-bio">{person.bio}</p>}
      {reason.kind === 'taste' && reason.drinks.length > 0 && <div className="swipe-person-shared">
        <ul aria-label="Нравится вам обоим">
          {reason.drinks.map(drink => <li key={drink.label} title={drink.label}>
            {drink.cover ? <CoverImage src={drink.cover} width={64} height={64} sizes="44px" alt={drink.label} draggable={false} /> : <span>{drink.label}</span>}
          </li>)}
        </ul>
        <span>Нравится вам обоим</span>
      </div>}
      <p className="swipe-person-stats">
        <span><b>{person.reviews}</b> {pluralRu(person.reviews, 'отзыв', 'отзыва', 'отзывов')}</span>
        <span><b>{person.followers}</b> {pluralRu(person.followers, 'подписчик', 'подписчика', 'подписчиков')}</span>
        {top && <Link className="swipe-more" href={`/profile/${encodeURIComponent(person.username)}`}>{PERSON}Профиль</Link>}
      </p>
    </div>
  </>;
}

/**
 * The drink swiped last and what to do with it next: rate it (the review form on its page opens by itself), or after
 * «нравится» keep it in the favourites. Before the first swipe the row says what will appear, so nothing jumps.
 */
function AfterSwipe({ after, onFavorite, reviewXp }: { after: { card: SwipeCard; liked: boolean; favorite: 'off' | 'saving' | 'on' } | null; onFavorite: () => void; reviewXp: number }) {
  if (!after) return <p className="swipe-after is-hint">
    <span className="swipe-after-hint-icons" aria-hidden="true">{STAR}{HEART}</span>
    После свайпа здесь можно оценить напиток или сохранить его в избранное
  </p>;
  const { card, liked, favorite } = after;
  // Keyed by the drink: each new swipe brings the card in afresh.
  return <div key={`${card.brand}:${card.flavor}`} className="swipe-after" data-liked={liked || undefined} aria-live="polite">
    <span className="swipe-after-cover">
      <CoverImage src={card.cover} width={64} height={64} sizes="48px" alt="" />
      <span className="swipe-after-mark" aria-hidden="true">{liked ? HEART : CROSS}</span>
    </span>
    <span className="swipe-after-name"><small>{liked ? 'Понравилось' : 'Пробовали?'}</small><b>{card.name}</b></span>
    <Link className="swipe-after-rate" href={`${card.href}?tab=reviews#write-review`} aria-label={`Оценить ${card.brand} · ${card.name}: +${reviewXp} XP за отзыв`}>
      {STAR}Оценить<span className="swipe-after-xp" aria-hidden="true">+{reviewXp} XP</span>
    </Link>
    {liked && <button type="button" className="swipe-after-favorite" aria-pressed={favorite === 'on'} disabled={favorite === 'saving'} onClick={onFavorite}
      aria-label={favorite === 'on' ? 'В избранном — убрать' : 'Добавить в избранное'} title={favorite === 'on' ? 'В избранном' : 'В избранное'}>
      {HEART}
    </button>}
  </div>;
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
      <span className="dating-reward-title"><ProfileTag tag={rewards.tag.key} title="Тег за свидание">{rewards.tag.label}</ProfileTag></span>
      <small aria-label={`Свайпы ${swipes} из ${rewards.swipeGoal}, мэтчи ${likes} из ${rewards.likeGoal}`}>{swipes}/{rewards.swipeGoal} свайпов · {likes}/{rewards.likeGoal} ♥</small>
      <span className="dating-reward-bar" aria-hidden="true"><span style={{ width: `${(swipes + likes) / (rewards.swipeGoal + rewards.likeGoal) * 100}%` }} /></span>
    </div>}
  </div>;
}
