'use client';
import Image from 'next/image';
import { useEffect, useRef, useState, useTransition } from 'react';
import { claimGiveawayAction, seenGiveawayAction } from '@/app/feed/giveaway-actions';
import { SpinIcon } from '@/components/gacha-icons';
import Link from '@/components/navigation-progress';
import { spinsWord } from '@/lib/spin-giveaway-fields';

type Giveaway = { id: string; title: string; body: string; spins: number; viewSeconds: number; taken: boolean };
const TICK_MS = 100;
const SPARKS = Array.from({ length: 14 }, (_, index) => index);

/**
 * A gift of Банкомат spins inside the feed. While the banner is on screen the key fills up (only then: a hidden tab or
 * a scrolled-away banner does not count), and a full key takes the spins. The server has its own clock from the first
 * look, the bar here is only what the viewer sees. `preview` is the admin form's copy: it changes nothing.
 */
export function SpinGiveawayBanner({ giveaway, signedIn, preview = false }: { giveaway: Giveaway; signedIn: boolean; preview?: boolean }) {
  const { id, spins, viewSeconds } = giveaway;
  const root = useRef<HTMLElement>(null);
  const asked = useRef(false);
  const [visible, setVisible] = useState(false);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [taken, setTaken] = useState(giveaway.taken);
  const [claimedNow, setClaimedNow] = useState(false);
  const [over, setOver] = useState(false);
  const [error, setError] = useState('');
  const [claiming, startClaim] = useTransition();
  const live = signedIn && !preview && !taken && !over;
  const ready = live && elapsed !== null && elapsed >= viewSeconds;

  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(Boolean(entry?.isIntersecting)), { threshold: 0.6 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!live || !visible || asked.current) return;
    asked.current = true;
    void seenGiveawayAction(id).then(seconds => {
      if (seconds === null) setOver(true);
      else setElapsed(seconds);
    }).catch(() => { asked.current = false; });
  }, [live, visible, id]);

  const charging = live && visible && elapsed !== null && !ready;
  useEffect(() => {
    if (!charging) return;
    const timer = setInterval(() => {
      if (!document.hidden) setElapsed(value => (value ?? 0) + TICK_MS / 1000);
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [charging]);

  const claim = () => startClaim(async () => {
    setError('');
    const result = await claimGiveawayAction(id).catch(() => ({ error: 'Не получилось забрать. Попробуйте ещё раз.' }));
    if ('spins' in result) {
      setTaken(true);
      setClaimedNow(true);
    } else {
      setError(result.error);
      if ('over' in result && result.over) setOver(true);
    }
  });

  const share = Math.min(1, (elapsed ?? 0) / viewSeconds);
  const left = Math.max(1, Math.ceil(viewSeconds - (elapsed ?? 0)));
  const phase = preview ? 'ready' : !signedIn ? 'guest' : taken ? 'taken' : over ? 'over' : ready ? 'ready' : 'charging';
  return <section ref={root} className="spin-drop" data-phase={phase} data-live={visible || undefined} data-burst={claimedNow || undefined} aria-label={`Подарок: ${spins} ${spinsWord(spins)} Банкомата`}>
    <span className="spin-drop-rays" aria-hidden="true" />
    <div className="spin-drop-head">
      <span className="spin-drop-art" aria-hidden="true">
        <Image src="/brand/home/gacha.svg" alt="" width={104} height={104} unoptimized />
        <span className="spin-drop-ticket is-one"><SpinIcon size={30} /></span>
        <span className="spin-drop-ticket is-two"><SpinIcon size={22} /></span>
      </span>
      <div className="spin-drop-copy">
        <span className="spin-drop-tag">Подарок от CanRush</span>
        <strong className="spin-drop-title">{giveaway.title}</strong>
        <p>{giveaway.body}</p>
      </div>
    </div>
    <div className="spin-drop-prize"><b>+{spins}</b><span>{spinsWord(spins)} Банкомата</span></div>
    {phase === 'guest' ? <Link className="game-btn spin-drop-key" data-tone="orange" href="/sign-in"><span className="game-btn-face"><span className="game-btn-label">Войти и забрать</span></span></Link>
      : phase === 'taken' ? <Link className="game-btn spin-drop-key" data-tone="violet" href="/gacha"><span className="game-btn-face"><span className="game-btn-label">Крутить</span><span className="game-btn-price">+{spins} уже у вас</span></span></Link>
      : phase === 'over' ? <p className="spin-drop-over">Раздача закончилась. Следите за лентой — будут ещё.</p>
      : phase === 'ready' ? <button className="game-btn spin-drop-key" data-tone="orange" type="button" disabled={preview || claiming} onClick={claim}><span className="game-btn-face"><span className="game-btn-label">{claiming ? 'Забираем…' : `Забрать +${spins}`}</span></span></button>
      : <div className="game-btn spin-drop-key" data-tone="charge" aria-hidden="true"><span className="game-btn-face">
        <span className="spin-drop-charge" style={{ transform: `scaleX(${share})` }} />
        <span className="game-btn-label">Заряжаем</span><span className="game-btn-price">{left} с</span>
      </span></div>}
    {error && !over && <p className="spin-drop-error" role="alert">{error}</p>}
    <span className="sr-only" role="status">{taken ? `${spins} ${spinsWord(spins)} у вас` : ready ? 'Крутки готовы, можно забрать' : ''}</span>
    {claimedNow && <span className="spin-drop-burst" aria-hidden="true">{SPARKS.map(index => <i key={index} style={{ '--spark': index } as React.CSSProperties} />)}</span>}
  </section>;
}
