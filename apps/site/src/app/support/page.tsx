import '@/styles/shared.css';
import '@/styles/market.css';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { BrandShell } from '@/components/brand-shell';
import Link from '@/components/navigation-progress';
import { ProfileNavigation } from '@/components/profile-navigation';
import { SupportChat } from '@/components/support-chat';
import { auth } from '@/lib/auth';
import { getOwnSupportThread, supportMessages } from '@/lib/support';

export const metadata: Metadata = { title: 'Поддержка', robots: { index: false } };

/**
 * «Помощь и поддержка» on its own page: the site's header and tab bar stay, the chat fills the rest of the screen —
 * the back arrow beside the team's name, the messages scrolling inside and the compose row at the bottom. Settings
 * and the «Поддержка ответила» notification lead here.
 */
export default async function SupportPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/sign-in');
  const thread = await getOwnSupportThread(session.user.id);
  const page = thread ? await supportMessages(thread.id) : { items: [], hasMore: false };
  return <BrandShell headerAction={<ProfileNavigation />} surfaceClassName="support-surface">
    <SupportChat initial={{ thread, ...page }} header={<header className="market-chat-header support-screen-header">
      <Link className="support-screen-back" href="/profile/settings" aria-label="Назад к настройкам">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5m6-7-7 7 7 7" /></svg>
      </Link>
      <span className="market-seller-avatar support-chat-avatar" aria-hidden="true" />
      <span className="market-chat-partner"><small>Команда CanRush</small><h1>Поддержка</h1></span>
    </header>} empty={<div className="market-chat-empty"><strong>Чем помочь?</strong><p>Вопрос, ошибка или идея — опишите, что делали и что пошло не так. Ответим здесь же и пришлём уведомление, обычно в течение дня.</p></div>} />
  </BrandShell>;
}
