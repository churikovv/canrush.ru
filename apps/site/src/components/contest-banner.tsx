import Image from 'next/image';
import Link from '@/components/navigation-progress';
import { contestChecklist, type Contest, type ContestEntry } from '@/lib/contest';
import { TELEGRAM_CHANNEL_URL } from '@/components/telegram-promo';

type Entry = (ContestEntry & { username: string | null }) | null;

function Check({ done }: { done: boolean | null }) {
  return <span className="contest-check" data-done={done ?? undefined} aria-hidden="true">
    {done ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg> : null}
  </span>;
}

/** Next step for a signed-in member: the required calendar can first, then the contact details. */
function nextAction(entry: NonNullable<Entry>) {
  const calendar = entry.username ? `/profile/${entry.username}/calendar` : '/profile';
  if (!entry.cans) return { href: calendar, label: 'Отметить банку в календаре' };
  if (!entry.telegram) return { href: '/profile/settings?section=telegram', label: 'Указать свой Telegram' };
  if (!entry.avatar) return { href: '/profile/settings?section=images', label: 'Поставить аватар' };
  return null;
}

/** Giveaway banner: on the home page it links to the rules, on /contest it is the page header. */
export function ContestBanner({ contest, entry, phase, variant = 'home' }: { contest: Contest; entry: Entry; phase: 'open' | 'results'; variant?: 'home' | 'page' }) {
  const items = contestChecklist(entry ?? { cans: 0, telegram: false, avatar: false });
  const action = phase === 'open' && entry ? nextAction(entry) : null;
  const Heading = variant === 'page' ? 'h1' : 'h2';
  return <section className="contest-banner" data-variant={variant} aria-labelledby="contest-title">
    <div className="contest-banner-copy">
      <p className="contest-badge">Конкурс · итоги {contest.resultsLabel}</p>
      <Heading id="contest-title">{phase === 'open' ? contest.heading : 'Подводим итоги розыгрыша'}</Heading>
      <p className="contest-lead">{contest.lead}</p>
      <ul className="contest-steps" aria-label={entry ? 'Ваш прогресс' : 'Условия'}>
        {items.map(item => <li key={item.key} data-done={entry && item.done ? '' : undefined}>
          <Check done={entry ? item.done : null} />
          <span>{item.label}{!item.required && <small>желательно</small>}</span>
        </li>)}
        {/* Subscription cannot be checked from the site, so this step is a link without a done state. */}
        <li className="contest-step-link"><a href={TELEGRAM_CHANNEL_URL} target="_blank" rel="noopener noreferrer">
          <span className="contest-check contest-check-telegram" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M21.4 3.6 2.9 10.8c-.9.4-.9 1.6.1 1.9l4.5 1.5 1.8 5.5c.2.7 1.1.9 1.6.4l2.6-2.4 4.6 3.4c.6.4 1.5.1 1.6-.6l3-15.6c.2-.9-.6-1.6-1.3-1.3Z" /></svg></span>
          <span>Подписаться на наш Telegram-канал<small>желательно</small></span><span className="contest-step-arrow" aria-hidden="true">↗</span>
        </a></li>
      </ul>
      {phase === 'open' && <div className="contest-actions">
        {!entry ? <Link className="contest-button" href="/sign-in">Войти и участвовать</Link>
          : action ? <Link className="contest-button" href={action.href}>{action.label}</Link>
          : <p className="contest-joined" role="status"><Check done /> Вы участвуете</p>}
        {variant === 'home' && <Link className="contest-rules-link" href="/contest">Все условия</Link>}
      </div>}
    </div>
    <div className="contest-banner-art">
      <Image src={contest.image.src} width={contest.image.width} height={contest.image.height} sizes="(max-width: 760px) 70vw, 380px" alt={contest.image.alt} priority={variant === 'page'} />
    </div>
  </section>;
}
