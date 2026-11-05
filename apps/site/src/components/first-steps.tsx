'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from '@/components/navigation-progress';
import { ActionToast } from '@/components/action-toast';
import { AvatarFrame } from '@/components/avatar-frame';
import { FirstStepsHide } from '@/components/first-steps-hide';
import { CapIcon, SpinIcon } from '@/components/gacha-icons';
import { NavigationIcon } from '@/components/navigation-icon';
import { ProfileTag } from '@/components/profile-tag';
import { VerifiedMark } from '@/components/verified-mark';
import { claimFirstStepAction, wearFirstStepAction } from '@/app/first-steps-actions';
import { peopleCardAction, personDecisionAction } from '@/app/community/dating-actions';
import { pluralRu } from '@/lib/drink-calendar-fields';
import type { ClaimStep, FirstStep, FirstStepReward, FirstStepsCard } from '@/lib/first-steps';
import type { PersonSuggestion } from '@/lib/people-suggestions';

type StepState = 'done' | 'claim' | 'current' | 'next';
type Reveal = { step: ClaimStep; reward: Extract<FirstStepReward, { kind: 'tag' | 'frame' }>; equipped: boolean };

const ICONS: Record<FirstStep['key'], ReactNode> = { gacha: <SpinIcon size={22} />, swipes: <NavigationIcon section="dating" />, follow: <NavigationIcon section="people" /> };
const CHECK = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4.5 4.5L19 7" /></svg>;
const GIFT = <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 11h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9ZM3 7.5h18V11H3zM12 7.5V21M12 7.5C10.5 4 7 3.6 7 5.6c0 1.5 2.4 1.9 5 1.9ZM12 7.5c1.5-3.5 5-3.9 5-1.9 0 1.5-2.4 1.9-5 1.9Z" /></svg>;
const ARROW = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
const SHUFFLE = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4.5h-4.5" /></svg>;
const PLUS = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>;
/** Sparks thrown out of the reveal: an angle each, no trigonometry in JS (the browser turns them). */
const SPARKS = [0, 36, 72, 108, 144, 180, 216, 252, 288, 324];

function stateOf(step: FirstStep, current: FirstStep['key'] | undefined): StepState {
  if (step.claimable) return 'claim';
  if (step.done) return 'done';
  return step.key === current ? 'current' : 'next';
}

/** What a step gives, drawn as itself: the caps, a card, the very tag, the very frame on the member's avatar. */
function Prize({ reward, avatar }: { reward: FirstStepReward; avatar: ReactNode }) {
  if (reward.kind === 'caps') return <span className="fs-prize fs-prize-caps"><CapIcon size={18} />+{reward.caps}</span>;
  if (reward.kind === 'card') return <span className="fs-prize fs-prize-card"><i aria-hidden="true" />Карточка</span>;
  if (reward.kind === 'tag') return <span className="fs-prize fs-prize-tag"><ProfileTag tag={reward.key}>{reward.label}</ProfileTag></span>;
  return <span className="fs-prize fs-prize-frame" title={`Рамка «${reward.label}»`}>{avatar}<AvatarFrame frame={reward.key} /><span className="sr-only">Рамка «{reward.label}»</span></span>;
}

function Avatar({ avatarId, name }: { avatarId: string | null; name: string | null }) {
  // eslint-disable-next-line @next/next/no-img-element -- a stored avatar served by our own route
  return avatarId ? <img src={`/api/profile-images/${avatarId}`} alt="" width={96} height={96} draggable={false} /> : <b aria-hidden="true">{(name ?? '?').slice(0, 1).toUpperCase()}</b>;
}

/** Someone to follow right on the card: one tap does the step. */
function PersonRow({ person, busy, onFollow, onOther }: { person: PersonSuggestion; busy: boolean; onFollow: () => void; onOther: () => void }) {
  const reason = person.reason.kind === 'taste'
    ? `${person.reason.shared} ${pluralRu(person.reason.shared, 'общий лайк', 'общих лайка', 'общих лайков')} с вами`
    : `${person.reviews} ${pluralRu(person.reviews, 'отзыв', 'отзыва', 'отзывов')} · активно на сайте`;
  return <div className="fs-person">
    <span className="fs-person-avatar"><Avatar avatarId={person.avatarId} name={person.username} /><AvatarFrame frame={person.frame} /></span>
    <span className="fs-person-text"><strong>@{person.username}{person.verified && <VerifiedMark />}</strong><small>{reason}</small></span>
    <button type="button" className="fs-icon-button" onClick={onOther} disabled={busy} aria-label="Показать другого участника" title="Другой участник">{SHUFFLE}</button>
    <button type="button" className="fs-go fs-go-follow" onClick={onFollow} disabled={busy}>{PLUS}{busy ? 'Секунду…' : 'Подписаться'}</button>
  </div>;
}

/** The full-screen moment a reward is taken: rays, a flash, sparks, and the reward itself in the middle. */
function RewardReveal({ reveal, avatar, onClose }: { reveal: Reveal; avatar: ReactNode; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [equipped, setEquipped] = useState(reveal.equipped);
  const [pending, setPending] = useState(false);
  // The toast is drawn inside the dialog: the top layer would cover it in body.
  const [error, setError] = useState<{ text: string; host: HTMLDialogElement | null } | null>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const tag = reveal.reward.kind === 'tag';
  async function wear() {
    setPending(true);
    const result = await wearFirstStepAction(reveal.step).catch(() => ({ error: 'Не удалось надеть. Проверьте интернет и попробуйте ещё раз.' }));
    setPending(false);
    if (result.error) setError({ text: result.error, host: dialog.current }); else setEquipped(true);
  }
  return <dialog ref={dialog} className="fs-reveal" data-kind={reveal.reward.kind} aria-labelledby="fs-reveal-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <p className="fs-reveal-kicker">{tag ? 'Новый тег' : 'Новая рамка'}</p>
    <div className="fs-reveal-stage">
      <span className="fs-reveal-rays" aria-hidden="true" />
      <span className="fs-reveal-sparks" aria-hidden="true">{SPARKS.map(angle => <i key={angle} style={{ '--a': `${angle}deg` } as CSSProperties} />)}</span>
      {reveal.reward.kind === 'tag' ? <span className="fs-reveal-tag"><ProfileTag tag={reveal.reward.key}>{reveal.reward.label}</ProfileTag></span>
        : <span className="fs-reveal-avatar">{avatar}<AvatarFrame frame={reveal.reward.key} /></span>}
    </div>
    <h2 id="fs-reveal-title">{reveal.reward.label}</h2>
    <p className="fs-reveal-text" role="status">{tag
      ? equipped ? 'Тег уже рядом с вашим именем — в ленте, отзывах и рейтинге.' : 'Тег в вашей коллекции. Наденьте его — он встанет рядом с именем.'
      : equipped ? 'Рамка уже на вашей аватарке. Она заряжается по кругу — смотрите сами.' : 'Рамка в вашей коллекции. Наденьте её — она встанет вокруг аватарки.'}</p>
    {tag && <span className="fs-reveal-chip">+20 XP</span>}
    <div className="fs-reveal-actions">
      {equipped ? <button type="button" className="fs-go fs-go-main" onClick={onClose} autoFocus>Круто!</button> : <>
        <button type="button" className="fs-go fs-go-main" onClick={wear} disabled={pending} autoFocus>{pending ? 'Надеваем…' : tag ? 'Надеть тег' : 'Надеть рамку'}</button>
        <button type="button" className="fs-go fs-go-ghost" onClick={onClose}>Позже</button>
      </>}
    </div>
    <ActionToast message={error?.text} tone="error" trigger={error ?? SPARKS} container={error?.host} />
  </dialog>;
}

/**
 * «Первые шаги» on the home page, above the feed: three short steps on one path — a free pull, five swipes in the drink
 * dating deck and a follow — each with its reward drawn as itself. The step in progress acts right in its row (the follow
 * offers a person on the spot); a done step glows until its reward is taken, then the reward opens full screen.
 */
export function FirstSteps({ card }: { card: FirstStepsCard }) {
  const router = useRouter();
  const [steps, setSteps] = useState(card.steps);
  const [person, setPerson] = useState(card.person);
  const [shown, setShown] = useState<string[]>(card.person ? [card.person.id] : []);
  const [busy, setBusy] = useState<string | null>(null);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [error, setError] = useState<{ text: string } | null>(null);
  const fail = (text: string) => setError({ text });
  const current = steps.find(step => !step.done)?.key;
  const done = steps.filter(step => step.done && !step.claimable).length;
  const avatar = <Avatar avatarId={card.avatarId} name={card.username} />;

  async function follow() {
    if (!person) return;
    setBusy('follow');
    const result = await personDecisionAction(person.id, 'follow').catch(() => ({ error: 'Не удалось подписаться. Проверьте интернет и попробуйте ещё раз.' }));
    setBusy(null);
    if (result.error) return fail(result.error);
    setSteps(list => list.map(step => step.key === 'follow' ? { ...step, done: true, claimable: true } : step));
  }
  async function other() {
    setBusy('other');
    const result = await peopleCardAction(shown).catch(() => ({ people: [] as PersonSuggestion[] }));
    setBusy(null);
    const next = 'people' in result ? result.people?.[0] : undefined;
    if (!next) return fail('Других предложений пока нет. Загляните в раздел «Люди».');
    setPerson(next); setShown(list => [...list, next.id]);
  }
  async function claim(step: FirstStep) {
    if (step.key === 'gacha' || (step.reward.kind !== 'tag' && step.reward.kind !== 'frame')) return;
    const key = step.key;
    const reward = step.reward;
    setBusy(key);
    const result = await claimFirstStepAction(key).catch(() => ({ ok: false as const, error: 'Не удалось забрать награду. Проверьте интернет и попробуйте ещё раз.' }));
    setBusy(null);
    if (!result.ok) return fail(result.error);
    setSteps(list => list.map(item => item.key === key ? { ...item, claimable: false } : item));
    setReveal({ step: key, reward, equipped: result.equipped });
  }

  return <section className="fs" aria-labelledby="fs-title">
    <div className="fs-head">
      <div>
        <p className="fs-kicker"><span>Первые шаги</span><b>{done} из {steps.length}</b></p>
        <h2 id="fs-title">Три шага — и тег с рамкой ваши</h2>
      </div>
      <FirstStepsHide />
    </div>
    <ol className="fs-path">{steps.map(step => {
      const state = stateOf(step, current);
      return <li key={step.key} className="fs-step" data-state={state}>
        <span className="fs-node" aria-hidden="true">{state === 'done' ? CHECK : state === 'claim' ? GIFT : ICONS[step.key]}</span>
        <div className="fs-body">
          <div className="fs-line">
            <strong className="fs-title">{step.title}{state === 'done' && <span className="sr-only"> — готово</span>}</strong>
            <Prize reward={step.reward} avatar={avatar} />
          </div>
          {state === 'claim' ? <small className="fs-hint">Готово! Награда ждёт</small> : state !== 'done' && <small className="fs-hint">{step.hint}</small>}
          {state === 'current' && step.progress && <div className="fs-progress" role="progressbar" aria-valuemin={0} aria-valuemax={step.progress.goal} aria-valuenow={step.progress.value} aria-label={`${step.title}: ${step.progress.value} из ${step.progress.goal}`}>
            {Array.from({ length: step.progress.goal }, (_, index) => <i key={index} data-on={index < step.progress!.value || undefined} />)}
            <span>{step.progress.value} из {step.progress.goal}</span>
          </div>}
          {state === 'current' && (step.key === 'follow' && person
            ? <PersonRow person={person} busy={busy !== null} onFollow={follow} onOther={other} />
            : <Link className="fs-go" href={step.href}>{step.action}{ARROW}</Link>)}
          {state === 'claim' && <button type="button" className="fs-go fs-go-claim" onClick={() => claim(step)} disabled={busy !== null}>
            {GIFT}{busy === step.key ? 'Открываем…' : step.reward.kind === 'tag' ? 'Забрать тег' : 'Забрать рамку'}
          </button>}
        </div>
      </li>;
    })}</ol>
    {reveal && <RewardReveal reveal={reveal} avatar={avatar} onClose={() => { setReveal(null); router.refresh(); }} />}
    <ActionToast message={error?.text} tone="error" trigger={error ?? SPARKS} />
  </section>;
}
