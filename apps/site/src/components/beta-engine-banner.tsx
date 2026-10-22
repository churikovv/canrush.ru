import Image from 'next/image';
import type { CSSProperties } from 'react';
import Link from '@/components/navigation-progress';
import { BETA_ENGINE_PLACES, type BetaEngine } from '@/lib/beta-engine';

const count = (value: number) => value.toLocaleString('ru-RU');
const TICKS = 10;

/** Home banner while the first 500 places last: every member now is part of building Canrush. */
export function BetaEngineBanner({ data, signedIn }: { data: BetaEngine; signedIn: boolean }) {
  const left = Math.max(BETA_ENGINE_PLACES - data.taken, 0);
  const share = Math.min(data.taken / BETA_ENGINE_PLACES, 1);
  const own = data.number;
  return <section className="engine-banner" aria-labelledby="engine-title" style={{ '--engine-share': share } as CSSProperties}>
    <span className="engine-mark engine-mark-tl" aria-hidden="true" /><span className="engine-mark engine-mark-tr" aria-hidden="true" />
    <span className="engine-mark engine-mark-bl" aria-hidden="true" /><span className="engine-mark engine-mark-br" aria-hidden="true" />
    <div className="engine-copy">
      <p className="engine-badge"><span aria-hidden="true">№</span>Бета Canrush</p>
      <h2 id="engine-title">Canrush заводится <span>с тебя</span></h2>
      <p className="engine-lead">Каждый, кто с нами сейчас, — вклад в развитие Canrush. Первым {BETA_ENGINE_PLACES} участникам — тег <strong>«Двигатель»</strong> и личный номер.</p>
      <p className="engine-ticket">
        <span>{own ? 'Твой номер' : <>Войдёшь сейчас<span className="engine-ticket-more"> — получишь</span></>}</span>
        <strong className="engine-number"><span aria-hidden="true">№</span>{own ?? Math.min(data.taken + 1, BETA_ENGINE_PLACES)}</strong>
      </p>
      {own ? <Link className="engine-button" href={data.username ? `/profile/${data.username}/achievements` : '/profile'}>Мой тег «Двигатель»</Link>
        : !signedIn && <Link className="engine-button" href="/sign-in">Занять место</Link>}
      <p className="engine-forever"><span aria-hidden="true">∞</span> Номер и тег <strong>остаются с тобой навсегда</strong></p>
    </div>
    <div className="engine-art"><Image src="/brand/achievements/engine.png" width={640} height={640} sizes="(max-width: 760px) 60vw, 340px" alt="Достижение «Двигатель беты»" /></div>
    <div className="engine-gauge">
      <div className="engine-gauge-head">
        <p><span>Занято мест</span><strong>{count(data.taken)}</strong> из {count(BETA_ENGINE_PLACES)}</p>
        <p className="engine-gauge-left"><span>Осталось</span>{count(left)}</p>
      </div>
      <div className="engine-track" role="meter" aria-label="Занято мест" aria-valuemin={0} aria-valuemax={BETA_ENGINE_PLACES} aria-valuenow={data.taken}>
        <span className="engine-fill" />
        {Array.from({ length: TICKS + 1 }, (_, index) => <span key={index} className="engine-tick" style={{ left: `${index * 100 / TICKS}%` }} aria-hidden="true" />)}
      </div>
      <p className="engine-note">Чем раньше — тем меньше твой номер.</p>
    </div>
  </section>;
}
