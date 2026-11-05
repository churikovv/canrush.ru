'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ActionToast } from '@/components/action-toast';
import { AvatarFrame } from '@/components/avatar-frame';
import { BottomSheet, BottomSheetHead } from '@/components/bottom-sheet';
import { ProfileTag } from '@/components/profile-tag';
import { claimDailyAction, wearDailyAction } from '@/app/daily-actions';
import { DAILY_DAYS, DAILY_ITEMS, moonLight, type DailyItem, type DailyReward, type DailyTrack } from '@/lib/daily-reward-fields';
import type { DailyState } from '@/lib/daily-rewards';

const DISMISSED = 'canrush-daily-dismissed';
const NO_NOTICE = {};
const SPARK = <svg className="daily-spark" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 1.5c.9 5.4 2.6 8.2 9.5 10.5-6.9 2.3-8.6 5.1-9.5 10.5-.9-5.4-2.6-8.2-9.5-10.5 6.9-2.3 8.6-5.1 9.5-10.5Z" /></svg>;
const CHECK = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4.5 4.5L19 7" /></svg>;
const KIND = { tag: 'тег', theme: 'фон профиля', frame: 'рамка' } as const;
const SPARKS = [0, 36, 72, 108, 144, 180, 216, 252, 288, 324];

function readDismissed(): string | null { try { return localStorage.getItem(DISMISSED); } catch { return null; } }
function writeDismissed(day: string) { try { localStorage.setItem(DISMISSED, day); } catch { /* private mode: the window simply shows again */ } }
const pluralDays = (value: number) => { const tens = value % 100, ones = value % 10; return tens >= 11 && tens <= 14 ? 'дней' : ones === 1 ? 'день' : ones >= 2 && ones <= 4 ? 'дня' : 'дней'; };
const pluralSparks = (value: number) => { const tens = value % 100, ones = value % 10; return tens >= 11 && tens <= 14 ? 'искр' : ones === 1 ? 'искра' : ones >= 2 && ones <= 4 ? 'искры' : 'искр'; };

/** The moon of a day of the path: a lit disc and a shadow shifted by how much of it is lit (`moonLight`). */
function Moon({ step, size = 'small' }: { step: number; size?: 'small' | 'big' }) {
  const { lit, waxing } = moonLight(step);
  // The shadow slides off the lit side: waxing is lit on the right, so its shadow moves left.
  return <span className={`daily-moon is-${size}`} style={{ '--shift': `${(waxing ? -1 : 1) * lit * 100}%` } as CSSProperties} aria-hidden="true"><i /></span>;
}

/** A thing of the path drawn as itself: the tag, a background swatch or the frame on the member's avatar. */
function ItemArt({ item, avatar, big = false }: { item: DailyItem; avatar: ReactNode; big?: boolean }) {
  if (item.kind === 'tag') return <span className="daily-item-tag"><ProfileTag tag={item.key}>{item.label}</ProfileTag></span>;
  if (item.kind === 'theme') return <span className={`appearance-swatch daily-item-theme${big ? ' is-big' : ''}`} data-profile-theme={item.key} aria-hidden="true"><i /><i /><i /><i /></span>;
  return <span className={`daily-item-frame${big ? ' is-big' : ''}`} aria-hidden="true">{avatar}<AvatarFrame frame={item.key as never} /></span>;
}

/** The same thing small enough for a day of the grid: the tag as its chip with the icon only. */
function MiniItem({ item, avatar }: { item: DailyItem; avatar: ReactNode }) {
  if (item.kind === 'tag') return <span className="daily-mini-tag"><ProfileTag tag={item.key}><span className="sr-only">{item.label}</span></ProfileTag></span>;
  return <ItemArt item={item} avatar={avatar} />;
}

function RewardLine({ reward, withItem = true }: { reward: DailyReward; withItem?: boolean }) {
  return <span className="daily-reward-line">
    <b>+{reward.xp} XP</b>
    {reward.sparks > 0 && <b>{SPARK}+{reward.sparks} {pluralSparks(reward.sparks)}</b>}
    {withItem && reward.item && <b>{KIND[reward.item.kind]} «{reward.item.label}»</b>}
  </span>;
}

/** The thing's moment, full screen (the «Первые шаги» reveal styles): rays, a flash, sparks, «Надеть» if its place was taken. */
function ItemReveal({ item, equipped: on, avatar, onClose }: { item: DailyItem; equipped: boolean; avatar: ReactNode; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [equipped, setEquipped] = useState(on);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ text: string; host: HTMLDialogElement | null } | null>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  async function wear() {
    setPending(true);
    const result = await wearDailyAction(item.key).catch(() => ({ error: 'Не удалось надеть. Проверьте интернет и попробуйте ещё раз.' }));
    setPending(false);
    if (result.error) setError({ text: result.error, host: dialog.current }); else setEquipped(true);
  }
  const text = {
    tag: equipped ? 'Тег уже рядом с вашим именем — в ленте, отзывах и рейтинге.' : 'Тег в вашей коллекции. Наденьте — он встанет рядом с именем.',
    theme: equipped ? 'Фон уже на вашем профиле.' : 'Фон в вашей коллекции. Наденьте — профиль сменит цвета.',
    frame: equipped ? 'Рамка уже на вашей аватарке.' : 'Рамка в вашей коллекции. Наденьте — она встанет вокруг аватарки.',
  }[item.kind];
  return <dialog ref={dialog} className="fs-reveal daily-reveal" data-kind={item.kind} aria-labelledby="daily-reveal-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <p className="fs-reveal-kicker">Лунный цикл · {KIND[item.kind]}</p>
    <div className="fs-reveal-stage">
      <span className="fs-reveal-rays" aria-hidden="true" />
      <span className="fs-reveal-sparks" aria-hidden="true">{SPARKS.map(angle => <i key={angle} style={{ '--a': `${angle}deg` } as CSSProperties} />)}</span>
      <span className={`daily-reveal-art is-${item.kind}`}><ItemArt item={item} avatar={avatar} big /></span>
    </div>
    <h2 id="daily-reveal-title">{item.label}</h2>
    <p className="fs-reveal-text" role="status">{text}</p>
    <div className="fs-reveal-actions">
      {equipped ? <button type="button" className="fs-go fs-go-main" onClick={onClose} autoFocus>Круто!</button> : <>
        <button type="button" className="fs-go fs-go-main" onClick={wear} disabled={pending} autoFocus>{pending ? 'Надеваем…' : 'Надеть'}</button>
        <button type="button" className="fs-go fs-go-ghost" onClick={onClose}>Позже</button>
      </>}
    </div>
    <ActionToast message={error?.text} tone="error" trigger={error ?? NO_NOTICE} container={error?.host} />
  </dialog>;
}

/** «Сегодня», «Забрано», «Через 3 дня» — for the day shown under the grid. */
function dayStatus(step: number, track: DailyTrack, done: boolean): string {
  if (step === track.step) return track.claimed ? 'Сегодня · забрано' : 'Сегодня';
  if (done) return `День ${step} · забрано`;
  const wait = step - track.step;
  return `День ${step} · через ${wait} ${pluralDays(wait)} подряд`;
}

/**
 * «Лунный цикл» — daily rewards on the home page. The window opens by itself once a day while today's reward waits
 * (closing it hides it until tomorrow, per browser); the slim row above the feed opens it any time. Inside: today's
 * moon, the 30 days of the path, today's reward and «Забрать».
 */
export function DailyRewards({ state }: { state: DailyState }) {
  const router = useRouter();
  const sheet = useRef<HTMLDialogElement>(null);
  const [track, setTrack] = useState<DailyTrack>(state.track);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: 'success' | 'error'; host: HTMLDialogElement | null } | null>(null);
  const [reveal, setReveal] = useState<{ item: DailyItem; equipped: boolean } | null>(null);
  const [stamped, setStamped] = useState(false);
  // The day shown under the grid: today until another day is tapped.
  const [picked, setPicked] = useState<number | null>(null);
  const shown = picked ?? track.step;
  const day = state.rewards[shown - 1]!;
  const isDone = (step: number) => step < track.step || (step === track.step && track.claimed);
  const { avatarId, username } = state;
  const avatar = avatarId
    // eslint-disable-next-line @next/next/no-img-element -- a stored avatar served by our own route
    ? <img src={`/api/profile-images/${avatarId}`} alt="" draggable={false} />
    : <b>{(username ?? '?').slice(0, 1).toUpperCase()}</b>;

  // Once a day, on the first visit of the home page, while today's reward waits.
  useEffect(() => {
    if (state.track.claimed || readDismissed() === state.today) return;
    const timer = window.setTimeout(() => sheet.current?.showModal(), 600);
    return () => window.clearTimeout(timer);
  }, [state.track.claimed, state.today]);

  const open = () => sheet.current?.showModal();
  const close = () => sheet.current?.close();
  function closed() {
    writeDismissed(state.today);
    if (stamped && !reveal) router.refresh();
  }
  async function claim() {
    setPending(true);
    const result = await claimDailyAction().catch(() => ({ ok: false as const, error: 'Не удалось забрать награду. Проверьте интернет и попробуйте ещё раз.' }));
    setPending(false);
    if (!result.ok) { setNotice({ text: result.error, tone: 'error', host: sheet.current }); return; }
    setTrack(result.track); setStamped(true);
    writeDismissed(state.today);
    if (result.reward.item) { close(); setReveal({ item: result.reward.item, equipped: result.equipped }); return; }
    setNotice({ text: `+${result.reward.xp} XP${result.reward.sparks ? ` и ${result.reward.sparks} ${pluralSparks(result.reward.sparks)}` : ''} — до завтра!`, tone: 'success', host: sheet.current });
  }

  const next = track.claimed && track.step < DAILY_DAYS ? state.rewards[track.step] : track.claimed ? state.rewards[0] : null;
  return <>
    <button type="button" className="daily-entry" onClick={open} data-ready={!track.claimed || undefined}>
      <Moon step={track.step} />
      <span className="daily-entry-text"><strong>Лунный цикл</strong>
        <small>День {track.step} из {DAILY_DAYS} · {track.claimed ? 'следующая награда завтра' : 'награда ждёт'}</small></span>
      <span className="daily-entry-go">{track.claimed ? 'Открыть' : 'Забрать'}</span>
    </button>

    <BottomSheet ref={sheet} className="daily-sheet" labelledBy="daily-title" onClose={closed}>
      <BottomSheetHead id="daily-title" title="Лунный цикл" onClose={close} />
      <div className="daily-hero">
        <Moon step={track.step} size="big" />
        <div>
          <p className="daily-hero-day">День {track.step} <span>из {DAILY_DAYS}</span></p>
          <p className="daily-hero-note">{state.track.restarted && !stamped ? 'Путь начался заново — луна снова растёт.' : 'Заходите каждый день: пропуск начинает путь с первого дня.'}</p>
        </div>
      </div>
      <ol className="daily-grid" aria-label={`Дни пути, сейчас ${track.step}-й`}>
        {state.rewards.map(reward => {
          const done = isDone(reward.step);
          const now = reward.step === track.step;
          return <li key={reward.step}><button type="button" className="daily-day" data-done={done || undefined} data-now={now || undefined} data-item={reward.item?.kind}
            aria-pressed={reward.step === shown} onClick={() => setPicked(reward.step === track.step ? null : reward.step)}
            aria-label={`День ${reward.step}${done ? ', забрано' : now ? ', сегодня' : ''}: ${reward.item ? `${KIND[reward.item.kind]} «${reward.item.label}»` : `${reward.xp} XP${reward.sparks ? ` и ${reward.sparks} ${pluralSparks(reward.sparks)}` : ''}`}`}>
            <small>{reward.step}</small>
            {reward.item ? <MiniItem item={reward.item} avatar={avatar} /> : <Moon step={reward.step} />}
            {done && <span className="daily-day-check">{CHECK}</span>}
          </button></li>;
        })}
      </ol>
      <div className="daily-today" aria-live="polite">
        <div className="daily-today-art">{day.item ? <ItemArt item={day.item} avatar={avatar} /> : <Moon step={day.step} size="big" />}</div>
        <div className="daily-today-text">
          <small>{dayStatus(day.step, track, isDone(day.step))}{day.item && ` · ${KIND[day.item.kind]}`}</small>
          {day.item && <strong>{day.item.label}</strong>}
          <RewardLine reward={day} withItem={false} />
          {day.item ? <p>{day.item.note}</p>
            : !isDone(day.step) && DAILY_ITEMS[day.step] && <p>«{DAILY_ITEMS[day.step]!.label}» уже у вас — вместо вещи {day.sparks} {pluralSparks(day.sparks)}.</p>}
        </div>
      </div>
      {track.claimed
        ? <p className="daily-next">{next && <>Завтра: <RewardLine reward={next} /></>}</p>
        : <button type="button" className="daily-claim" onClick={claim} disabled={pending}>{pending ? 'Забираем…' : shown === track.step ? 'Забрать' : `Забрать награду дня ${track.step}`}</button>}
      <ActionToast message={notice?.text} tone={notice?.tone} trigger={notice ?? NO_NOTICE} container={notice?.host} />
    </BottomSheet>

    {reveal && <ItemReveal item={reveal.item} equipped={reveal.equipped} avatar={avatar} onClose={() => { setReveal(null); router.refresh(); }} />}
  </>;
}
