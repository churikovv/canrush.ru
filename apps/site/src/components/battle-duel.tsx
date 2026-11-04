'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { cancelDuelAction, duelStatusAction, inviteFriendAction, joinDuelAction } from '@/app/gacha/battle/duel-actions';
import { ActionToast } from '@/components/action-toast';
import { RingIcon } from '@/components/gacha-icons';
import Link from '@/components/navigation-progress';
import type { DuelPlayer } from '@/lib/battle-duel';
import { DUEL_COOKIE, MISSED_LIMIT, TURN_SECONDS } from '@/lib/battle-duel-fields';
import { nativeShare } from '@/lib/native-app';
import { SITE_URL } from '@/lib/seo';

const NO_NOTICE = {};
const POLL_MS = 2000;
type Notice = { text: string; tone: 'success' | 'error' } | null;

/** Аватарка участника в круге лобби; без неё — первая буква имени. */
export function DuelFace({ name, avatarId, size = 84 }: { name: string; avatarId: string | null; size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element -- a stored avatar served by our own route, sized by the circle
  return avatarId ? <img src={`/api/profile-images/${avatarId}`} alt="" width={size} height={size} /> : <span className="bt-duel-initial" aria-hidden="true">{name.replace('@', '').slice(0, 1).toUpperCase()}</span>;
}

/** Ссылка вызова живёт в cookie, пока гость входит: после входа сайт открывает `/profile`, а он ведёт сюда (`profile/page.tsx`). */
export function ForgetDuelCookie() {
  useEffect(() => { document.cookie = `${DUEL_COOKIE}=; path=/; max-age=0; samesite=lax`; }, []);
  return null;
}

function Top() {
  return <header className="bt-lobby-top">
    <Link className="game-round is-back" href="/gacha/battle" aria-label="К битве банок"><span aria-hidden="true">‹</span></Link>
  </header>;
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const CLOCK = <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2M9 2h6" /></svg>;
const FLAG = <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}><path d="M6 21V4h11l-2.5 4 2.5 4H6" /></svg>;
const CARDS = <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}><rect x="7" y="4" width="12" height="16" rx="2" /><path d="M4 7v11a2 2 0 0 0 2 2" /></svg>;
const FRIENDS = <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></svg>;

/** Правила дуэли — четыре коротких факта вместо абзаца. */
function DuelFacts() {
  return <ul className="bt-duel-facts" aria-label="Правила боя с другом">
    <li>{CLOCK}{TURN_SECONDS} с на ход</li>
    <li>{FLAG}{MISSED_LIMIT} пропуска — поражение</li>
    <li>{CARDS}Колода из Банкомата</li>
    <li><RingIcon size={18} />Без колечек</li>
  </ul>;
}

/** Комната хозяина: ссылка, «Поделиться», друзья с сайта, ожидание соперника. */
export function DuelRoom({ code, friends }: { code: string; friends: (DuelPlayer & { invited: boolean })[] }) {
  const router = useRouter();
  const [notice, setNotice] = useState<Notice>(null);
  const [invited, setInvited] = useState(() => new Set(friends.filter(friend => friend.invited).map(friend => friend.id)));
  const [pending, setPending] = useState<string | null>(null);
  const left = useRef(false);
  const path = `/gacha/battle/duel/${code}`;
  // The page shows the site's address; sharing takes the one the page is open on (it differs only in development).
  const link = () => `${window.location.origin}${path}`;

  // The guest's acceptance starts the fight: the page then shows the board instead of this room.
  useEffect(() => {
    let timer = 0, stopped = false;
    const check = async () => {
      const status = await duelStatusAction(code).catch(() => 'open');
      if (stopped || left.current) return;
      if (status !== 'open') { router.refresh(); return; }
      timer = window.setTimeout(check, POLL_MS);
    };
    timer = window.setTimeout(check, POLL_MS);
    return () => { stopped = true; clearTimeout(timer); };
  }, [code, router]);

  async function share() {
    const title = 'Битва банок в CanRush';
    const text = 'Вызываю тебя на битву банок!';
    try {
      const url = link();
      const native = await nativeShare({ title, text, url, dialogTitle: title });
      if (native === 'cancelled') return;
      if (native === 'shared') { setNotice({ text: 'Ссылка отправлена', tone: 'success' }); return; }
      if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
        try { await navigator.share({ title, text, url }); setNotice({ text: 'Ссылка отправлена', tone: 'success' }); return; } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') return;
        }
      }
      await copy();
    } catch { setNotice({ text: 'Не получилось поделиться. Скопируйте ссылку.', tone: 'error' }); }
  }

  async function copy() {
    try { await navigator.clipboard.writeText(link()); setNotice({ text: 'Ссылка скопирована', tone: 'success' }); } catch { setNotice({ text: 'Не удалось скопировать: выделите ссылку вручную.', tone: 'error' }); }
  }

  async function invite(friend: DuelPlayer) {
    setPending(friend.id);
    try {
      const result = await inviteFriendAction(code, friend.id);
      if (result.error) { setNotice({ text: result.error, tone: 'error' }); return; }
      setInvited(current => new Set(current).add(friend.id));
      setNotice({ text: `Позвали @${friend.username}`, tone: 'success' });
    } catch { setNotice({ text: 'Связь пропала. Попробуйте ещё раз.', tone: 'error' }); } finally { setPending(null); }
  }

  async function cancel() {
    left.current = true;
    await cancelDuelAction(code).catch(() => undefined);
    router.replace('/gacha/battle');
  }

  return <div className="bt-screen" data-no-pull>
    <div className="bt-stage bt-lobby bt-duel">
      <Top />
      <div className="bt-lobby-title">
        <h1>Вызов другу</h1>
        <p className="bt-duel-wait" role="status"><span aria-hidden="true" />Ждём соперника</p>
      </div>
      <section className="bt-duel-card" aria-label="Ссылка на вызов">
        <p className="bt-duel-lead">Бой начнётся, когда друг примет вызов.</p>
        <div className="bt-duel-link">
          <input readOnly value={`${SITE_URL}${path}`} aria-label="Ссылка на вызов" onFocus={event => event.currentTarget.select()} />
          <button type="button" className="bt-duel-copy" onClick={() => void copy()} aria-label="Копировать ссылку"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" /></svg><span>Копировать</span></button>
        </div>
        <button type="button" className="game-btn bt-duel-share" data-tone="orange" onClick={() => void share()}><span className="game-btn-face"><span className="game-btn-label">Поделиться</span></span></button>
      </section>
      <section className="bt-duel-card" aria-labelledby="duel-friends-title">
        <h2 id="duel-friends-title">Позвать с сайта</h2>
        {friends.length ? <ul className="bt-duel-friends">{friends.map(friend => {
          const name = `@${friend.username}`;
          const done = invited.has(friend.id);
          return <li key={friend.id}>
            <span className="bt-duel-avatar"><DuelFace name={name} avatarId={friend.avatarId} size={40} /></span>
            <span className="bt-duel-name">{name}</span>
            <button type="button" className="bt-duel-invite" disabled={done || pending === friend.id} onClick={() => void invite(friend)}>{done ? 'Позвали' : pending === friend.id ? '…' : 'Позвать'}</button>
          </li>;
        })}</ul> : <div className="bt-duel-empty">
          <span className="bt-duel-empty-icon" aria-hidden="true">{FRIENDS}</span>
          <span><strong>Друзей пока нет</strong><small>Взаимные подписки на сайте</small></span>
        </div>}
      </section>
      <DuelFacts />
      <button type="button" className="bt-duel-cancel" onClick={() => void cancel()}>Отменить вызов</button>
    </div>
    <ActionToast message={notice?.text} tone={notice?.tone} trigger={notice ?? NO_NOTICE} />
  </div>;
}

/** Страница вызова для гостя: кто зовёт и «Принять вызов». Без входа — войти, а ссылка запоминается в cookie. */
export function DuelInvite({ code, host, signedIn }: { code: string; host: { name: string; avatarId: string | null }; signedIn: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    document.cookie = signedIn ? `${DUEL_COOKIE}=; path=/; max-age=0; samesite=lax` : `${DUEL_COOKIE}=${code}; path=/; max-age=1800; samesite=lax`;
  }, [code, signedIn]);

  async function accept() {
    setBusy(true);
    try {
      const result = await joinDuelAction(code);
      if (result.error) { setNotice({ text: result.error, tone: 'error' }); setBusy(false); return; }
      router.refresh();
    } catch { setNotice({ text: 'Связь пропала. Попробуйте ещё раз.', tone: 'error' }); setBusy(false); }
  }

  return <div className="bt-screen" data-no-pull>
    <div className="bt-stage bt-lobby bt-duel">
      <Top />
      <span className="bt-lobby-rival bt-duel-host"><DuelFace name={host.name} avatarId={host.avatarId} /></span>
      <div className="bt-lobby-title">
        <h1>Битва банок</h1>
        <p>{host.name} вызывает вас на бой</p>
      </div>
      <section className="bt-duel-card">
        <p className="bt-duel-lead">Выкладывайте карточки банок и бейте героя соперника. У кого первым кончится здоровье, тот проиграл.</p>
        <DuelFacts />
      </section>
      {signedIn
        ? <button type="button" className="game-btn bt-lobby-go" data-tone="orange" disabled={busy} onClick={() => void accept()}><span className="game-btn-face"><span className="game-btn-label">{busy ? 'Садимся за стол…' : 'Принять вызов'}</span></span></button>
        : <div className="bt-duel-guest">
          <Link className="game-btn bt-lobby-go" data-tone="orange" href="/sign-in"><span className="game-btn-face"><span className="game-btn-label">Войти и принять</span></span></Link>
          <small>После входа вернём вас к вызову</small>
        </div>}
    </div>
    <ActionToast message={notice?.text} tone={notice?.tone} trigger={notice ?? NO_NOTICE} />
  </div>;
}

/** Вызов, который уже не действует, или бой без вас. */
export function DuelGone({ text }: { text: string }) {
  return <div className="bt-screen" data-no-pull>
    <div className="bt-stage bt-lobby bt-duel">
      <Top />
      <div className="bt-lobby-title">
        <h1>Битва банок</h1>
        <p>{text}</p>
      </div>
      <Link className="game-btn bt-lobby-go" data-tone="orange" href="/gacha/battle"><span className="game-btn-face"><span className="game-btn-label">Сыграть с Совой</span></span></Link>
    </div>
  </div>;
}
