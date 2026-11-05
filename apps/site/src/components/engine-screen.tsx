'use client';

import { useRouter } from 'next/navigation';
import { useRef, type CSSProperties } from 'react';
import { BottomSheet, BottomSheetHead } from '@/components/bottom-sheet';
import Link from '@/components/navigation-progress';
import { TurnScene } from '@/components/turn-scene';
import type { BetaEngine, EngineCrewMember } from '@/lib/beta-engine';
import { BETA_ENGINE_PLACES } from '@/lib/beta-engine-fields';
import { pluralRu } from '@/lib/drink-calendar-fields';

/** The engine's loop in Blender (`marketing/design/3d/build_engine.py`): one turn, like the pass can, so a finger can turn it. */
const ENGINE_LOOP_SECONDS = 6;
const count = (value: number) => value.toLocaleString('ru-RU');

/**
 * «Двигатель беты» as a game screen, like the season pass: the engine idles on the stand, the number is the hero, the
 * gauge fills towards 500 and the rail shows who started up last. The number is given at sign-up — nothing to claim here.
 */
export function EngineScreen({ engine, crew, signedIn }: { engine: BetaEngine; crew: EngineCrewMember[]; signedIn: boolean }) {
  const router = useRouter();
  const rules = useRef<HTMLDialogElement>(null);
  const rail = useRef<HTMLOListElement>(null);
  const left = Math.max(BETA_ENGINE_PLACES - engine.taken, 0);
  const own = engine.number;
  const next = left > 0 ? engine.taken + 1 : null;

  function leave() {
    if (window.history.length > 1) router.back();
    else router.push('/');
  }

  const [kicker, number, line] = own
    ? ['Твой номер', own, 'Тег «Двигатель» и номер остаются с тобой навсегда.']
    : !signedIn && next
      ? ['Свободное место', next, 'Войди — и этот номер твой. Чем раньше, тем меньше номер.']
      : [left ? 'Бета CanRush' : 'Все места заняты', null, left ? 'Номера получают первые 500 участников при регистрации.' : `Первые ${BETA_ENGINE_PLACES} уже с нами. Спасибо, что ты тоже здесь.`];

  return <main className="pass-screen engine-screen" data-stage="2" data-no-pull>
    <TurnScene base="/brand/engine/engine" stages={1} seconds={ENGINE_LOOP_SECONDS} stage={1} flash={0} turnable />
    <header className="pass-top">
      <button type="button" className="can-plate pass-icon-btn" onClick={leave} aria-label="Назад"><span aria-hidden="true">‹</span></button>
      <div className="pass-title">
        <h1>Двигатель беты</h1>
        <p>{left ? `Осталось ${count(left)} ${pluralRu(left, 'место', 'места', 'мест')}` : 'Все места заняты'}</p>
      </div>
      <button type="button" className="can-plate pass-icon-btn engine-help" onClick={() => rules.current?.showModal()} aria-label="Как это работает"><span aria-hidden="true">?</span></button>
    </header>

    <section className="pass-hero" aria-live="polite">
      <span className="pass-kicker">{kicker}</span>
      {number ? <h2 className="engine-number"><span aria-hidden="true">№</span>{count(number)}</h2> : <h2>Canrush заводится с тебя</h2>}
      <p>{line}</p>
    </section>

    <section className="pass-action">
      <div className="pass-progress">
        <span className="pass-progress-line"><b>Занято {count(engine.taken)} из {count(BETA_ENGINE_PLACES)}</b><small>{left ? `осталось ${count(left)}` : 'мест нет'}</small></span>
        <span className="can-meter" role="meter" aria-label="Занято мест" aria-valuemin={0} aria-valuemax={BETA_ENGINE_PLACES} aria-valuenow={engine.taken}>
          <i style={{ '--share': Math.min(engine.taken / BETA_ENGINE_PLACES, 1) } as CSSProperties} />
        </span>
      </div>
      {own ? <Link className="can-btn pass-cta" href={engine.username ? `/profile/${encodeURIComponent(engine.username)}/achievements` : '/profile'}>Мой тег «Двигатель»</Link>
        : !signedIn && next ? <Link className="can-btn pass-cta" data-ready="" href="/sign-in">Занять место № {count(next)}</Link> : null}
    </section>

    {crew.length > 0 && <section className="engine-crew" aria-labelledby="engine-crew-title">
      <h2 id="engine-crew-title">Последние двигатели</h2>
      <div className="pass-rail-box">
        <button type="button" className="can-plate pass-icon-btn pass-rail-arrow" onClick={() => rail.current?.scrollBy({ left: -rail.current.clientWidth * 0.8, behavior: 'smooth' })} aria-label="Назад по списку"><span aria-hidden="true">‹</span></button>
        <ol className="pass-rail" ref={rail} tabIndex={0} aria-labelledby="engine-crew-title">
          {crew.map(member => <li key={member.number}>
            <Link className="can-plate pass-tile engine-crew-tile" data-state={member.number === own ? 'ready' : 'claimed'} href={`/profile/${encodeURIComponent(member.username)}`}>
              <span className="pass-tile-level">{member.number}</span>
              {/* eslint-disable-next-line @next/next/no-img-element -- a stored avatar served by our own route */}
              <span className="engine-crew-avatar">{member.avatarId ? <img src={`/api/profile-images/${member.avatarId}`} alt="" width={40} height={40} loading="lazy" /> : member.username.slice(0, 1).toUpperCase()}</span>
              <b>@{member.username}</b>
              <span className="sr-only">, номер {member.number}</span>
            </Link>
          </li>)}
        </ol>
        <button type="button" className="can-plate pass-icon-btn pass-rail-arrow" onClick={() => rail.current?.scrollBy({ left: rail.current.clientWidth * 0.8, behavior: 'smooth' })} aria-label="Вперёд по списку"><span aria-hidden="true">›</span></button>
      </div>
    </section>}

    <p className="pass-note">Номер выдаётся сам при регистрации, по порядку. Номер удалённого аккаунта никому не переходит.</p>

    <BottomSheet ref={rules} className="engine-rules" labelledBy="engine-rules-title">
      <BottomSheetHead id="engine-rules-title" title="Как это работает" onClose={() => rules.current?.close()} />
      <ol>
        <li><strong>Кто получает.</strong> Первые {BETA_ENGINE_PLACES} участников, которые создали аккаунт в CanRush. Номер выдаётся сам при регистрации — ничего делать не нужно.</li>
        <li><strong>Номер.</strong> Чем раньше ты с нами, тем меньше номер. Он виден в твоём теге и в карточке в разделе «Люди».</li>
        <li><strong>Навсегда.</strong> Номер и тег «Двигатель» остаются с тобой, даже когда все места займут. Номер удалённого аккаунта никому не переходит.</li>
        <li><strong>Тег.</strong> Его можно надеть на экране достижений, чтобы он стоял рядом с твоим именем.</li>
      </ol>
    </BottomSheet>
  </main>;
}
