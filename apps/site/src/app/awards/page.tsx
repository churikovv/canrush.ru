import '@/styles/shared.css';
import '@/styles/awards.css';
import Image from 'next/image';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { AwardsBoard } from '@/components/awards-board';
import { BrandShell } from '@/components/brand-shell';
import Link from '@/components/navigation-progress';
import { ProfileNavigation } from '@/components/profile-navigation';
import { SignInPrompt } from '@/components/sign-in-prompt';
import { auth } from '@/lib/auth';
import { ensureAwardNominees, getAwardBoard } from '@/lib/awards';
import { AWARD, AWARD_MIN_ACCOUNT_DAYS, AWARD_MIN_REVIEWS, awardPhase } from '@/lib/awards-fields';
import { seoMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export function generateMetadata() {
  return seoMetadata({
    title: `${AWARD.title} ${AWARD.year}`,
    description: `Голосование участников CanRush: лучший дизайн, лучший вкус, энергетик года и лучший без сахара. Голосуйте до ${AWARD.lastDayLabel}, итоги ${AWARD.resultsLabel}.`,
    path: '/awards',
  });
}

/**
 * «Премия за энергию» (/awards): the members' vote for the drinks of the year in four categories. The rules are on the
 * page; the board (`AwardsBoard`) votes, adds a drink and shows ratings, reviews and — after one's vote — the shares.
 */
export default async function AwardsPage() {
  const phase = awardPhase();
  if (phase === 'upcoming' || phase === 'over') notFound();
  const session = await auth.api.getSession({ headers: await headers() });
  await ensureAwardNominees().catch(error => console.error('award nominees', error));
  const board = await getAwardBoard(session?.user.id ?? null);
  const open = phase === 'open';
  return <BrandShell headerAction={<ProfileNavigation active="community" />}>
    <div className="awards-page">
      <section className="awards-stage" aria-labelledby="awards-title">
        <Image className="awards-trophy" src="/brand/awards/trophy.webp" width={772} height={800} sizes="(min-width: 960px) 260px, 112px" priority unoptimized alt="" />
        <header className="awards-stage-head">
          <span className="awards-chip">{open ? `Голосование до ${AWARD.lastDayLabel}` : `Итоги · ${AWARD.resultsLabel}`}</span>
          <h1 id="awards-title">{AWARD.title} <span>{AWARD.year}</span></h1>
          <p>{open ? 'Голосуют участники CanRush. Нажмите на номинацию и выберите своего номинанта — или добавьте свой напиток.' : 'Голоса посчитаны — вот кого участники CanRush выбрали лучшими в этом году.'}</p>
          {board.voters > 0 && <span className="awards-voters">Уже проголосовали: <b>{new Intl.NumberFormat('ru-RU').format(board.voters)}</b></span>}
        </header>
        <AwardsBoard board={board} signedIn={Boolean(session)} />
      </section>

      {open && !session && <SignInPrompt title="Войдите, чтобы проголосовать" text="Голос — один в каждой номинации, его можно поменять до конца голосования." />}
      {open && session && board.block && <p className="awards-notice" role="status">{board.block}{/ник/.test(board.block) && <> <Link href="/profile/settings">Открыть настройки</Link></>}</p>}

      <section className="awards-rules" aria-labelledby="awards-rules-title">
        <h2 id="awards-rules-title">Как голосуем</h2>
        <ul>
          {open
            ? <li><b>До {AWARD.lastDayLabel} включительно.</b> В каждой номинации один голос — нажмите на неё и выберите номинанта. Голос можно поменять.</li>
            : <li><b>Голосование закончилось.</b> Голоса принимались до {AWARD.lastDayLabel} включительно.</li>}
          <li><b>Итоги — {AWARD.resultsLabel}.</b> Побеждает напиток с наибольшим числом голосов.</li>
        </ul>
        <details className="awards-more">
          <summary>Все условия</summary>
          <ul>
            <li><b>Номинанты.</b> Лучшие по оценкам участников — от {AWARD_MIN_REVIEWS} отзывов, — и напитки, которые добавили сами участники.</li>
            <li><b>Свой фаворит.</b> Нет нужного напитка? В номинации нажмите «Добавить свой напиток» и найдите его в каталоге — он станет вашим голосом и появится в списке.</li>
            <li><b>Без подсказок.</b> Сколько у кого голосов, видно после вашего голоса в номинации, чтобы выбор был своим.</li>
            <li><b>Честно.</b> Голосуют участники с ником, аккаунт старше {AWARD_MIN_ACCOUNT_DAYS} дней. Голоса заблокированных не считаются.</li>
            <li><b>Равенство.</b> Если у напитков поровну голосов, выше тот, у кого лучше оценка участников.</li>
          </ul>
        </details>
      </section>
    </div>
  </BrandShell>;
}
