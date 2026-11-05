'use client';

import type { CSSProperties, ReactNode } from 'react';
import Link from '@/components/navigation-progress';
import { canSkin } from '@/lib/can-skin';
import { cutoutSrc } from '@/lib/can-cutout-src';
import { FLAVOR_TOKENS } from '@/lib/pick-reason';
import type { PicksProfile, StoryRecommendation } from '@/lib/story-digest';

/** Everything the picks story knows, shared by its first and last slide. */
export interface PicksView { basis: 'similar' | 'community'; profile: PicksProfile; items: StoryRecommendation[]; username: string | null }
/** What the viewer did with a pick inside the story. */
export type PickDecision = 'favorite' | 'nope';

const line = (index: number) => ({ '--line': index }) as CSSProperties;
function plural(value: number, one: string, few: string, many: string) {
  const tens = value % 100, ones = value % 10;
  if (tens >= 11 && tens <= 14) return many;
  return ones === 1 ? one : ones >= 2 && ones <= 4 ? few : many;
}
const ARROW = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
const HEART = (filled: boolean) => <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" d="M12 21s-7.5-4.6-9.6-9.3C.9 8.2 3 4.5 6.6 4.5c2.1 0 3.6 1.2 4.4 2.5.8-1.3 2.3-2.5 4.4-2.5 3.6 0 5.7 3.7 4.2 7.2C19.5 16.4 12 21 12 21Z" /></svg>;
const NOPE = <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>;

/** A can on its own: the cutout of our own cover, the cover itself, or a bolt when there is none. */
function Can({ cover, size = 'big' }: { cover: string | null; size?: 'big' | 'small' }) {
  const cut = cover ? cutoutSrc(cover) : null;
  // eslint-disable-next-line @next/next/no-img-element -- our own covers and their cutouts
  return cover ? <img src={cut ?? cover} alt="" data-cutout={cut ? '' : undefined} draggable={false} className={`pick-can-img is-${size}`} />
    : <span className={`pick-can-img is-${size} is-empty`} aria-hidden="true">⚡</span>;
}

/** «Burn Манго, Red Bull Тропики и ещё 1»: two names at most, so the line stays one or two lines long. */
function names(labels: string[]) {
  const shown = labels.slice(0, 2), more = labels.length - shown.length;
  return more ? `${shown.join(', ')} и ещё ${more}` : shown.join(' и ');
}

/** «Почему тебе»: the reason in the viewer's own terms, with the people and their own drinks that stand behind it. */
function Why({ item }: { item: StoryRecommendation }) {
  const reason = item.reason;
  let text: ReactNode;
  let caption: string | null = null;
  if (reason.kind === 'similar') {
    const shown = item.fans.slice(0, 2).map(fan => `@${fan.username}`);
    const more = Math.max(0, reason.fans - shown.length);
    text = reason.fans
      ? shown.length
        ? <>Нравится <b>{shown.join(', ')}</b>{more ? ` и ещё ${more} ${plural(more, 'человеку', 'людям', 'людям')}` : ''} с похожим вкусом</>
        : <>Нравится <b>{reason.fans} {plural(reason.fans, 'человеку', 'людям', 'людям')}</b> с похожим вкусом</>
      : <>Похоже на то, что ты любишь</>;
    caption = 'У вас общие любимые:';
  } else if (reason.kind === 'brand') {
    text = <>Ты высоко оцениваешь <b>{reason.brand}</b>, а этот вкус ещё впереди</>;
    caption = `Твои любимые от ${reason.brand}:`;
  } else if (reason.kind === 'flavor') {
    text = <>Ты любишь вкусы с <b>{FLAVOR_TOKENS[reason.token] ?? reason.token}</b></>;
    caption = 'Как твои любимые:';
  } else {
    text = <>Средняя оценка вкуса <b>{reason.taste.toLocaleString('ru-RU')} из 10</b> · {reason.reviews} {plural(reason.reviews, 'отзыв', 'отзыва', 'отзывов')}</>;
  }
  return <section className="pick-why">
    <h3>Почему тебе</h3>
    <p>{reason.kind === 'similar' && item.fans.length > 0 && <span className="pick-fans" aria-hidden="true">{item.fans.map(fan => <span key={fan.username}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a stored avatar served by our own route */}
      {fan.avatarId ? <img src={`/api/profile-images/${fan.avatarId}`} alt="" /> : fan.username.slice(0, 1).toUpperCase()}
    </span>)}</span>}{text}</p>
    {caption && item.because.length > 0 && <div className="pick-because">
      <span className="pick-because-cans" aria-hidden="true">{item.because.map(drink => <Can key={drink.label} cover={drink.cover} size="small" />)}</span>
      <small>{caption} {names(item.because.map(drink => reason.kind === 'brand' ? drink.flavor : drink.label))}</small>
    </div>}
  </section>;
}

/**
 * One pick: the can glowing in its flavour's colour, how well it fits, where it sells in the city, why it is here — the
 * viewer's own drinks and the people behind it — and three things to do: open it, keep it, or say it is not for them.
 */
export function PickSlide({ item, basis, index, total, decision, onFavorite, onNope }: {
  item: StoryRecommendation; basis: 'similar' | 'community'; index: number; total: number;
  decision: PickDecision | undefined; onFavorite: () => void; onNope: () => void;
}) {
  const tint = canSkin(item.brand, item.flavor).a;
  const kept = decision === 'favorite';
  return <div className="pick" style={{ '--pick': tint } as CSSProperties} data-nope={decision === 'nope' || undefined}>
    <span className="pick-glow" aria-hidden="true" />
    <small className="pick-kicker" style={line(0)}>{basis === 'similar' ? 'Для тебя' : 'Популярно'} · {index} из {total}</small>
    <div className="pick-stage" style={line(1)}>
      <Can cover={item.cover} />
      {item.match !== null && <span className="pick-match" style={{ '--m': item.match } as CSSProperties} aria-label={`Совпадение с твоим вкусом ${item.match}%`}>
        <b>{item.match}%</b><small>совпадение</small>
      </span>}
    </div>
    <div className="pick-name" style={line(2)}><small>{item.brand}</small><strong>{item.name}</strong></div>
    <ul className="pick-facts" style={line(3)}>
      {item.price !== null ? <li>от {item.price.toLocaleString('ru-RU')} ₽</li> : <li>Сейчас нет в продаже</li>}
      {item.stores > 0 && <li>{item.stores} {plural(item.stores, 'магазин', 'магазина', 'магазинов')}</li>}
      {item.sugarfree && <li>Без сахара</li>}
    </ul>
    <div style={line(4)}><Why item={item} /></div>
    <div className="pick-actions" style={line(5)}>
      <Link className="pick-open" href={item.href}>Открыть{ARROW}</Link>
      <button type="button" className="pick-round" aria-pressed={kept} aria-label={kept ? 'Убрать из избранного' : 'В избранное'} title={kept ? 'В избранном' : 'В избранное'} onClick={onFavorite}>{HEART(kept)}</button>
      <button type="button" className="pick-round" aria-label="Не моё — показывать такое реже" title="Не моё" disabled={decision === 'nope'} onClick={onNope}>{NOPE}</button>
    </div>
  </div>;
}

/** The first and the last slide: who the picks are for and what they know, then all of them at a glance. */
export function PicksCover({ page, picks }: { page: 'intro' | 'outro'; picks: PicksView }) {
  const { profile, basis, items } = picks;
  const shapes = <span className="wrap-shapes" aria-hidden="true"><i /><i /><i /></span>;
  if (page === 'outro') return <div className="picks-cover" data-page="outro">{shapes}
    <small style={line(0)}>Подборка дня</small>
    <strong className="picks-title" style={line(1)}>Завтра — новая</strong>
    <ul className="picks-grid" style={line(2)}>{items.map(item => <li key={item.href}>
      <Link href={item.href} aria-label={`${item.brand} ${item.name}`}><Can cover={item.cover} size="small" />{item.match !== null && <b>{item.match}%</b>}</Link>
    </li>)}</ul>
    <p style={line(3)}>Каждая оценка и свайп делают подборку точнее.</p>
    <Link className="story-card-cta pick-cta" style={line(4)} href="/community?type=dating">Листать дейтинг{ARROW}</Link>
  </div>;
  const counts = [
    profile.reviews && `${profile.reviews} ${plural(profile.reviews, 'оценке', 'оценкам', 'оценкам')}`,
    profile.favorites && `${profile.favorites} ${plural(profile.favorites, 'избранному', 'избранным', 'избранным')}`,
    profile.swipes && `${profile.swipes} ${plural(profile.swipes, 'свайпу', 'свайпам', 'свайпам')}`,
  ].filter(Boolean) as string[];
  const chips = [...profile.loves, ...(profile.brand ? [`Любимый бренд — ${profile.brand}`] : []), ...(profile.sugarfree ? ['Без сахара'] : [])];
  return <div className="picks-cover" data-page="intro">{shapes}
    <small style={line(0)}>Подборка дня{picks.username && <> для <span className="picks-for">@{picks.username}</span></>}</small>
    <strong className="picks-title" style={line(1)}>{basis === 'community' ? 'Начнём с любимого сообщества' : profile.title ? <>Твой вкус —<br />{profile.title}</> : 'Собрали под твой вкус'}</strong>
    <p style={line(2)}>{basis === 'community'
      ? 'Пока мы мало знаем о твоём вкусе. Оцени пару напитков или полистай дейтинг — и подборка станет личной.'
      : profile.lead ?? 'Пять напитков, которых у тебя ещё не было, — от людей с похожим вкусом и по твоим оценкам.'}</p>
    {basis === 'similar' && chips.length > 0 && <ul className="picks-chips" style={line(3)}>{chips.map(chip => <li key={chip}>{chip}</li>)}</ul>}
    {counts.length > 0 && <p className="picks-basis" style={line(4)}>Собрано по {counts.join(', ').replace(/, ([^,]*)$/, ' и $1')}</p>}
    <span className="picks-fan" style={line(5)} aria-hidden="true">{items.slice(0, 3).map(item => <Can key={item.href} cover={item.cover} size="small" />)}</span>
  </div>;
}
