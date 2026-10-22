import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import Link from '@/components/navigation-progress';
import { BrandShell } from '@/components/brand-shell';
import { ProfileNavigation } from '@/components/profile-navigation';
import { ContestBanner } from '@/components/contest-banner';
import { auth } from '@/lib/auth';
import { currentContest } from '@/lib/contest';
import { getContestEntry } from '@/lib/contest-db';
import { seoMetadata } from '@/lib/seo';
import { TELEGRAM_CHANNEL_URL } from '@/components/telegram-promo';

export const dynamic = 'force-dynamic';
export function generateMetadata() {
  const contest = currentContest(new Date())?.contest;
  return seoMetadata({ title: contest ? `Конкурс: ${contest.heading.replace(/^Выиграй /, '')}` : 'Конкурс', description: contest ? `Отметьте банку в календаре выпитого до ${contest.lastDayLabel} и участвуйте в розыгрыше. ${contest.lead} Итоги ${contest.resultsLabel}.` : 'Конкурсы Canrush', path: '/contest' });
}

export default async function ContestPage() {
  const current = currentContest(new Date());
  if (!current) notFound();
  const { contest, phase } = current;
  const session = await auth.api.getSession({ headers: await headers() });
  const entry = session ? await getContestEntry(contest, session.user.id) : null;
  return <BrandShell headerAction={<ProfileNavigation active="home" />}>
    <div className="contest-page">
      <ContestBanner contest={contest} entry={entry} phase={phase} variant="page" />
      <section className="contest-rules" aria-labelledby="contest-rules-title">
        <h2 id="contest-rules-title">Условия</h2>
        <ol>
          <li><strong>Приз.</strong> {contest.lead}</li>
          <li><strong>Как участвовать.</strong> Хотя бы раз отметить банку в <Link href={entry?.username ? `/profile/${entry.username}/calendar` : '/sign-in'}>календаре выпитого</Link> до {contest.lastDayLabel} включительно. Больше отметок — шанс тот же: один участник, один билет.</li>
          <li><strong>Связь.</strong> Укажите свой Telegram в <Link href="/profile/settings?section=telegram">настройках профиля</Link>, чтобы мы могли написать победителю напрямую.</li>
          <li><strong>Канал.</strong> Желательно подписаться на наш <a href={TELEGRAM_CHANNEL_URL} target="_blank" rel="noopener noreferrer">Telegram-канал @canrushoff</a>.</li>
          <li><strong>Не бот.</strong> Заполните профиль хотя бы минимально — например, поставьте аватар.</li>
          <li><strong>Возраст.</strong> Участвовать могут только совершеннолетние (18+): возраст проверим при вручении приза.</li>
          <li><strong>Итоги.</strong> {contest.resultsLabel} выберем победителя случайным образом среди участников. Если победитель не выйдет на связь, переиграем без него. Организаторы сайта не участвуют, заблокированные аккаунты не учитываются.</li>
          <li><strong>Бесплатно.</strong> Участие ничего не стоит, покупать ничего не нужно — подойдёт любая выпитая банка.</li>
        </ol>
        <p className="contest-good-luck">Всем удачи!</p>
      </section>
    </div>
  </BrandShell>;
}
