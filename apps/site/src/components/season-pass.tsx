'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition, type CSSProperties, type PointerEvent, type ReactNode, type SyntheticEvent } from 'react';
import { claimSeasonPassAction } from '@/app/pass/actions';
import { ActionToast } from '@/components/action-toast';
import { CapIcon, RingIcon, ShardIcon, SpinIcon } from '@/components/gacha-icons';
import Link from '@/components/navigation-progress';
import { pluralRu } from '@/lib/drink-calendar-fields';
import { RARITY_LABELS } from '@/lib/gacha-fields';
import { PASS_LOOP_SECONDS, PASS_STAGES, passStage, passStageOpensAt, seasonTitle, type PassRewardKind } from '@/lib/season-fields';
import type { PassLevelView, SeasonPassView } from '@/lib/season-pass';

const NO_NOTICE = {};
const SEEN_KEY = 'canrush-pass-stage';
/** Сколько пикселей пальцем — полный оборот банки. */
const TURN_PX = 420;

const REWARD_ICONS: Record<PassRewardKind, ReactNode> = {
  caps: <CapIcon size={26} />, shards: <ShardIcon size={24} />, spins: <SpinIcon size={26} />, rings: <RingIcon size={26} />,
};
const REWARD_FORMS: Record<PassRewardKind, [string, string, string]> = {
  caps: ['крышка', 'крышки', 'крышек'], shards: ['осколок', 'осколка', 'осколков'], spins: ['крутка', 'крутки', 'круток'], rings: ['колечко', 'колечка', 'колечек'],
};
const rewardLabel = (kind: PassRewardKind, amount: number) => `+${amount.toLocaleString('ru-RU')} ${pluralRu(amount, ...REWARD_FORMS[kind])}`;

const CHECK = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>;
const LOCK = <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5Zm3 8H9V7a3 3 0 0 1 6 0v3Z" /></svg>;
const BOLT = <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 2 5 14h6l-1 8 9-12h-6l1-8Z" /></svg>;

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const levelState = (level: PassLevelView) => (level.claimed ? 'claimed' : level.reached ? 'ready' : 'locked');

/**
 * Сцена из Blender: петля одного оборота банки. Новая стадия проявляется поверх старой с той же секунды петли, поэтому
 * банка превращается на месте, а не сменяется другим роликом. Палец крутит банку перемоткой петли.
 */
function PassScene({ stage, flash }: { stage: number; flash: number }) {
  const [layers, setLayers] = useState([stage]);
  if (layers.at(-1) !== stage) setLayers([layers.at(-1) ?? stage, stage]);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; time: number } | null>(null);
  const top = () => [...(box.current?.querySelectorAll('video') ?? [])].at(-1) ?? null;

  // Постеры всех стадий заранее: выбор уровня в ленте не должен мигать пустым кадром.
  useEffect(() => { PASS_STAGES.forEach((_, index) => { new Image().src = `/brand/pass/can-${index + 1}.webp`; }); }, []);
  useEffect(() => { if (reducedMotion()) top()?.pause(); }, [layers]);

  function join(event: SyntheticEvent<HTMLVideoElement>) {
    const lower = event.currentTarget.previousElementSibling;
    if (lower instanceof HTMLVideoElement) event.currentTarget.currentTime = lower.currentTime;
  }
  function grab(event: PointerEvent<HTMLDivElement>) {
    const video = top();
    if (!video) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    video.pause();
    drag.current = { x: event.clientX, time: video.currentTime };
  }
  function turn(event: PointerEvent<HTMLDivElement>) {
    const video = top();
    if (!drag.current || !video || video.seeking) return;
    // Время идёт — передняя сторона банки едет влево, поэтому палец вправо отматывает петлю назад.
    const time = drag.current.time - ((event.clientX - drag.current.x) / TURN_PX) * PASS_LOOP_SECONDS;
    video.currentTime = ((time % PASS_LOOP_SECONDS) + PASS_LOOP_SECONDS) % PASS_LOOP_SECONDS;
  }
  function release() {
    if (!drag.current) return;
    drag.current = null;
    if (!reducedMotion()) void top()?.play().catch(() => undefined);
  }

  return <div className="pass-slot" ref={box} onPointerDown={grab} onPointerMove={turn} onPointerUp={release} onPointerCancel={release}>
    {layers.map(item => <video key={item} className="pass-video" src={`/brand/pass/can-${item}.mp4`} poster={`/brand/pass/can-${item}.webp`} autoPlay loop muted playsInline preload="auto" aria-hidden="true"
      onLoadedMetadata={join} onAnimationEnd={() => setLayers(list => (list.at(-1) === item ? [item] : list))} />)}
    {flash > 0 && <span key={flash} className="pass-flash" aria-hidden="true" />}
  </div>;
}

/** Сезонный пропуск отдельным экраном. Бесплатный: уровни растут только от действий на сайте, за деньги не продаётся. */
export function SeasonPass({ initial, signedIn, daysLeft }: { initial: SeasonPassView; signedIn: boolean; daysLeft: number }) {
  const router = useRouter();
  const [pass, setPass] = useState(initial);
  const [picked, setPicked] = useState<number | null>(null);
  const [flash, setFlash] = useState(0);
  const [notice, setNotice] = useState<{ text: string; tone: 'success' | 'error' } | null>(null);
  const [pending, start] = useTransition();
  const rail = useRef<HTMLOListElement>(null);

  const current = passStage(pass.reached);
  const level = picked ? pass.levels[picked - 1] : undefined;
  const stage = level ? passStage(level.level) : current;
  const info = PASS_STAGES[stage - 1];
  const opened = level ? passStageOpensAt(level.level) : undefined;
  const { progress } = pass;

  // Лента открывается на текущем уровне.
  useEffect(() => {
    const box = rail.current;
    const tile = box?.querySelector<HTMLElement>('[data-current]');
    if (box && tile) box.scrollLeft = tile.offsetLeft - (box.clientWidth - tile.offsetWidth) / 2;
  }, []);

  // Банка выросла с прошлого визита — вспышка и тост. Браузер помнит только номер стадии за этот сезон.
  useEffect(() => {
    if (!signedIn) return;
    const timer = setTimeout(() => {
      try {
        const [season, seen] = (localStorage.getItem(SEEN_KEY) ?? '').split(':');
        localStorage.setItem(SEEN_KEY, `${initial.season}:${passStage(initial.reached)}`);
        const stageNow = passStage(initial.reached);
        if (season === initial.season && Number(seen) < stageNow) {
          setFlash(Date.now());
          setNotice({ text: `Банка выросла: «${PASS_STAGES[stageNow - 1]?.name}»`, tone: 'success' });
        }
      } catch { /* нет доступа к хранилищу — просто без вспышки */ }
    }, 500);
    return () => clearTimeout(timer);
  }, [initial, signedIn]);

  function leave() {
    if (window.history.length > 1) router.back();
    else router.push('/');
  }

  function claim() {
    start(async () => {
      const response = await claimSeasonPassAction();
      if ('error' in response) { setNotice({ text: response.error, tone: 'error' }); return; }
      setPass(response.pass);
      const summary = (['spins', 'caps', 'rings', 'shards'] as const).flatMap(kind => {
        const total = response.claimed.filter(item => item.kind === kind).reduce((sum, item) => sum + item.amount, 0);
        return total ? [rewardLabel(kind, total)] : [];
      });
      setNotice({ text: `Получено: ${summary.join(', ')}`, tone: 'success' });
    });
  }

  return <main className="pass-screen" data-stage={stage} data-no-pull>
    <PassScene stage={stage} flash={flash} />
    <header className="pass-top">
      <button type="button" className="can-plate pass-icon-btn" onClick={leave} aria-label="Назад"><span aria-hidden="true">‹</span></button>
      <div className="pass-title">
        <h1>Сезонный пропуск</h1>
        <p>{seasonTitle(pass.season)} · {daysLeft === 1 ? 'последний день' : `дней до конца: ${daysLeft}`}</p>
      </div>
      {signedIn && <span className="can-plate pass-points" title="Очки сезона">{BOLT}{pass.points.toLocaleString('ru-RU')}<span className="sr-only"> очков</span></span>}
    </header>

    <section className="pass-hero" aria-live="polite">
      {level ? <>
        <span className="pass-kicker">Уровень {level.level}</span>
        <h2>{REWARD_ICONS[level.kind]} {rewardLabel(level.kind, level.amount)}</h2>
        <p>{level.claimed ? 'Награда забрана.' : level.reached ? 'Можно забрать.' : `Откроется на ${level.points.toLocaleString('ru-RU')} очках.`}{opened ? ` Открывает банку «${opened.name}».` : ''}</p>
      </> : <>
        {info && <span className="pass-kicker">{RARITY_LABELS[info.rarity]}</span>}
        <h2>{info?.name}</h2>
        <p>{info?.line}</p>
      </>}
    </section>

    <section className="pass-action">
      {signedIn ? <div className="pass-progress">
        <span className="pass-progress-line"><b>Уровень {pass.reached} из {pass.levels.length}</b><small>{progress ? `ещё ${progress.left.toLocaleString('ru-RU')} ${pluralRu(progress.left, 'очко', 'очка', 'очков')}` : 'все пройдены'}</small></span>
        <span className="can-meter" aria-hidden="true"><i style={{ '--share': progress ? progress.share : 1 } as CSSProperties} /></span>
      </div> : <p className="pass-guest">Бесплатные награды за активность на сайте.</p>}
      {signedIn
        ? pass.ready > 0 && <button type="button" className="can-btn pass-cta" data-ready="" disabled={pending} onClick={claim}>Забрать · {pass.ready}</button>
        : <Link className="can-btn pass-cta" href="/sign-in">Войти и участвовать</Link>}
    </section>

    <div className="pass-rail-box">
      <button type="button" className="can-plate pass-icon-btn pass-rail-arrow" onClick={() => rail.current?.scrollBy({ left: -rail.current.clientWidth * 0.8, behavior: 'smooth' })} aria-label="Назад по уровням"><span aria-hidden="true">‹</span></button>
      <ol className="pass-rail" ref={rail} tabIndex={0} aria-label="Уровни пропуска">
        {pass.levels.map(item => {
          const can = passStageOpensAt(item.level);
          return <li key={item.level} data-current={item.level === Math.min(pass.reached + 1, pass.levels.length) ? '' : undefined}>
            <button type="button" className="can-plate pass-tile" data-state={levelState(item)} data-kind={item.kind} aria-pressed={picked === item.level} onClick={() => setPicked(value => (value === item.level ? null : item.level))}>
              <span className="pass-tile-level">{item.level}</span>
              <span className="pass-tile-reward">{REWARD_ICONS[item.kind]}</span>
              <b>+{item.amount}</b>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {can && <img className="pass-tile-can" src={`/brand/pass/can-${passStage(item.level)}-cutout.webp`} width={107} height={300} alt="" />}
              {levelState(item) !== 'ready' && <span className="pass-tile-state">{item.claimed ? CHECK : LOCK}</span>}
              <span className="sr-only">{REWARD_FORMS[item.kind][1]}, {item.claimed ? 'забрано' : item.reached ? 'можно забрать' : 'ещё не открыто'}{can ? `, новая банка «${can.name}»` : ''}</span>
            </button>
          </li>;
        })}
      </ol>
      <button type="button" className="can-plate pass-icon-btn pass-rail-arrow" onClick={() => rail.current?.scrollBy({ left: rail.current.clientWidth * 0.8, behavior: 'smooth' })} aria-label="Вперёд по уровням"><span aria-hidden="true">›</span></button>
    </div>

    <p className="pass-note">Очки — опыт за сезон, награды рейтинга и трекер банок не считаются. В новом сезоне банка начинается заново, незабранное сгорает.</p>
    <ActionToast message={notice?.text} tone={notice?.tone} trigger={notice ?? NO_NOTICE} />
  </main>;
}
