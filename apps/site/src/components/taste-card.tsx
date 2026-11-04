'use client';

import { useEffect, useState } from 'react';
import { tasteCardAction, type TasteCardState } from '@/app/community/dating-actions';
import { updateCommunityAction } from '@/app/profile/community-actions';
import { ActionToast } from '@/components/action-toast';
import { CoverImage } from '@/components/cover-image';
import Link from '@/components/navigation-progress';
import { cutoutSrc } from '@/lib/can-cutout-src';
import { shareImage } from '@/lib/share-image';
import { TASTE_CARD_MIN } from '@/lib/taste-card-fields';
import type { TasteMatch } from '@/lib/taste-card';
import { renderTasteShare } from '@/lib/taste-share-image';

const NO_NOTICE = {};
type Notice = { text: string; tone: 'success' | 'error' } | null;

function plural(count: number, one: string, few: string, many: string) {
  const tens = count % 100, ones = count % 10;
  return tens >= 11 && tens <= 14 ? many : ones === 1 ? one : ones >= 2 && ones <= 4 ? few : many;
}

/** Банка без фона магазина (`/api/can-cutouts`), а если вырезать нельзя — обычное фото на светлой подложке. */
function CanImage({ cover, label }: { cover: string; label: string }) {
  const cut = cutoutSrc(cover);
  const [plain, setPlain] = useState(!cut);
  // eslint-disable-next-line @next/next/no-img-element -- a cut-out can from our own route, sized by its tile
  return <img src={plain ? cover : cut!} alt={label} title={label} data-plain={plain || undefined} loading="lazy" onError={() => { if (!plain) setPlain(true); }} />;
}

/** Один участник с похожим вкусом: аватар, ник, общие лайки и «Подписаться» прямо здесь. */
function TasteMatchCard({ match, onNotice }: { match: TasteMatch; onNotice: (notice: Notice) => void }) {
  const [following, setFollowing] = useState(false);
  const [pending, setPending] = useState(false);
  async function follow() {
    setPending(true);
    const form = new FormData();
    form.set('operation', 'follow');
    form.set('targetId', match.id);
    try {
      const result = await updateCommunityAction({}, form);
      if (result.error) onNotice({ text: result.error, tone: 'error' });
      else { setFollowing(true); onNotice({ text: `Вы подписались на @${match.username}`, tone: 'success' }); }
    } catch { onNotice({ text: 'Связь пропала. Попробуйте ещё раз.', tone: 'error' }); } finally { setPending(false); }
  }
  return <section className="taste-match" aria-labelledby="taste-match-title">
    <h3 id="taste-match-title">Похожий вкус</h3>
    <div className="taste-match-row">
      <Link className="taste-match-person" href={`/profile/${encodeURIComponent(match.username)}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- a stored avatar served by our own route */}
        <span className="taste-match-avatar">{match.avatarId ? <img src={`/api/profile-images/${match.avatarId}`} alt="" width={48} height={48} /> : match.username.slice(0, 1).toUpperCase()}</span>
        <span className="taste-match-text"><strong>@{match.username}</strong><small>{match.shared} {plural(match.shared, 'общий лайк', 'общих лайка', 'общих лайков')}</small></span>
      </Link>
      {following
        ? <Link className="taste-match-follow is-done" href={`/profile/${encodeURIComponent(match.username)}`}>В профиль</Link>
        : <button type="button" className="taste-match-follow" disabled={pending} onClick={() => void follow()}>{pending ? '…' : 'Подписаться'}</button>}
    </div>
    {match.drinks.length > 0 && <ul className="taste-match-drinks" aria-label="Нравится обоим">
      {match.drinks.map(drink => <li key={drink.label} title={drink.label}>
        {drink.cover ? <CoverImage src={drink.cover} width={56} height={56} sizes="56px" alt={drink.label} /> : <span>{drink.label}</span>}
      </li>)}
    </ul>}
  </section>;
}

/**
 * «Твой вкус» в конце колоды дейтинга: архетип по своим решениям, любимые и нелюбимые вкусы, бренд, «Поделиться»
 * картинкой и один человек с похожим вкусом. Подписки сильнее всего удерживают новичков — поэтому он здесь.
 */
export function TasteEnd({ onMore }: { onMore: () => void }) {
  const [state, setState] = useState<TasteCardState | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    let alive = true;
    void tasteCardAction().then(result => { if (alive) setState(result); }).catch(() => { if (alive) setState({ error: 'Связь пропала.' }); });
    return () => { alive = false; };
  }, []);

  const card = state && 'card' in state ? state.card : null;
  async function share() {
    if (!card) return;
    setSharing(true);
    try {
      const result = await shareImage(await renderTasteShare(card), 'canrush-taste.png', 'Мой вкус в CanRush');
      if (result === 'saved') setNotice({ text: 'Картинка сохранена', tone: 'success' });
    } catch { setNotice({ text: 'Не получилось поделиться. Попробуйте ещё раз.', tone: 'error' }); } finally { setSharing(false); }
  }

  const more = <button type="button" className="community-button community-button-secondary taste-more" onClick={onMore}>Ещё карточки</button>;
  return <div className="taste-end">
    {!state ? <div className="taste-bento is-loading" aria-busy="true"><div className="bento-tile bento-hero"><small className="bento-kicker">Твой вкус</small><strong>Собираем…</strong></div></div>
      : !card ? <div className="swipe-empty taste-empty">
        <strong>На сегодня всё</strong>
        <p>{'error' in state ? state.error : `Ещё немного свайпов — и покажем твой вкус: нужно хотя бы ${TASTE_CARD_MIN} решений.`}</p>
        {more}
      </div>
      : <>
        <article className="taste-bento" aria-labelledby="taste-title">
          <div className="bento-tile bento-hero">
            <small className="bento-kicker"><span className="bento-mark" aria-hidden="true" />Твой вкус</small>
            <h2 id="taste-title">{card.title}</h2>
            <p>{card.lead}</p>
          </div>
          {card.loves.length > 0 && <div className="bento-tile bento-loves">
            <small className="bento-kicker">Любишь</small>
            <ul>{card.loves.map((item, index) => <li key={item.key} data-pos={index}>{item.label}</li>)}</ul>
          </div>}
          {card.drinks.length > 0 && <div className="bento-tile bento-cans">
            <small className="bento-kicker">Любимые банки</small>
            <ul data-count={card.drinks.length}>{card.drinks.map((drink, index) => <li key={drink.label} data-pos={index}><CanImage cover={drink.cover} label={drink.label} /></li>)}</ul>
          </div>}
          <div className="bento-tile bento-stat">
            <small className="bento-kicker">{card.brand ? 'Любимый бренд' : 'Нравится'}</small>
            <strong>{card.brand ? card.brand.name : `${Math.round((100 * card.likes) / card.decisions)}%`}</strong>
          </div>
          <div className="bento-tile bento-stat bento-count">
            <small className="bento-kicker">Оценено</small>
            <strong>{card.decisions}</strong>
            <span>{plural(card.decisions, 'напиток', 'напитка', 'напитков')} · {card.likes} нравится</span>
          </div>
          {card.avoids.length > 0 && <div className="bento-tile bento-avoids" data-span={card.sugarfree ? undefined : 2}>
            <small className="bento-kicker">Не твоё</small>
            <ul>{card.avoids.map(item => <li key={item.key}>{item.label}</li>)}</ul>
          </div>}
          {card.sugarfree && <div className="bento-tile bento-stat" data-span={card.avoids.length ? undefined : 2}>
            <small className="bento-kicker">Без сахара</small>
            <strong>{card.sugarfree === 'loves' ? 'Да' : 'Не твоё'}</strong>
          </div>}
        </article>
        <div className="taste-actions">
          <button type="button" className="community-button taste-share" disabled={sharing} onClick={() => void share()}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 15V3m0 0L7 8m5-5 5 5M5 13v6h14v-6" /></svg>
            {sharing ? 'Готовим картинку…' : 'Поделиться'}
          </button>
          {more}
        </div>
        {state && 'match' in state && state.match && <TasteMatchCard match={state.match} onNotice={setNotice} />}
      </>}
    <ActionToast message={notice?.text} tone={notice?.tone} trigger={notice ?? NO_NOTICE} />
  </div>;
}
