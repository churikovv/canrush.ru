import Image from 'next/image';
import type { CSSProperties } from 'react';
import Link from '@/components/navigation-progress';
import { pluralRu } from '@/lib/drink-calendar-fields';
import { PASS_STAGES, passStage, seasonTitle } from '@/lib/season-fields';
import type { SeasonPassView } from '@/lib/season-pass';

/** Вход в сезонный пропуск из рейтинга: банка участника, уровень и полоса до следующего, всё в цвете стадии его банки. */
export function SeasonPassEntry({ pass, signedIn }: { pass: SeasonPassView; signedIn: boolean }) {
  const { progress, ready } = pass;
  const stage = passStage(pass.reached);
  return <Link className="pass-entry" href="/pass" data-stage={stage}>
    <span className="pass-entry-can"><Image src={`/brand/pass/can-${stage}-cutout.webp`} width={107} height={300} sizes="56px" unoptimized priority alt="" /></span>
    <span className="pass-entry-copy">
      <small>{seasonTitle(pass.season)}</small>
      <b>Сезонный пропуск</b>
      <span className="pass-entry-line">{signedIn ? `Банка «${PASS_STAGES[stage - 1]?.name}»` : 'Бесплатные награды за активность'}</span>
      {signedIn && <span className="pass-entry-progress">
        <span className="pass-entry-levels"><span>Уровень {pass.reached} из {pass.levels.length}</span><span>{progress ? `ещё ${progress.left.toLocaleString('ru-RU')} ${pluralRu(progress.left, 'очко', 'очка', 'очков')}` : 'все пройдены'}</span></span>
        <span className="can-meter" aria-hidden="true"><i style={{ '--share': progress ? progress.share : 1 } as CSSProperties} /></span>
      </span>}
    </span>
    <span className="can-btn pass-entry-cta" data-ready={ready > 0 ? '' : undefined}>{ready > 0 ? `Забрать · ${ready}` : 'Открыть'}</span>
  </Link>;
}
