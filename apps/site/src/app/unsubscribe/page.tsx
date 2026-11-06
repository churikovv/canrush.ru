import '@/styles/shared.css';
import '@/styles/auth.css';
import type { Metadata } from 'next';
import Link from '@/components/navigation-progress';
import { BrandShell } from '@/components/brand-shell';
import { ProfileNavigation } from '@/components/profile-navigation';
import { comebackSubscribed } from '@/lib/comeback-email';
import { isUnsubscribeToken } from '@/lib/comeback-email-fields';
import { getAuthEnv } from '@/lib/env';
import { unsubscribeAction } from './actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Отписка от писем',
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
};

const one = (value: string | string[] | undefined) => Array.isArray(value) ? undefined : value;
const SETTINGS = '/profile/settings?section=notifications';

/**
 * Отписка от писем «Что нового на CanRush» по ссылке из письма — без входа. Ссылка только открывает страницу: отписка —
 * кнопкой (POST), потому что почтовые сканеры сами открывают ссылки из писем. Почтовые программы отписывают в один
 * клик через `/api/unsubscribe`.
 */
export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const user = one(params.u), token = one(params.t);
  const valid = Boolean(user && isUnsubscribeToken(user, token, getAuthEnv().authSecret));
  const subscribed = valid && user ? await comebackSubscribed(user) : true;
  const copy = one(params.done) ? { title: 'Готово, письма больше не придут', text: 'Включить их снова можно в настройках уведомлений.' }
    : one(params.error) || !valid ? { title: 'Ссылка не сработала', text: 'Она могла быть повреждена при копировании. Отключить письма можно в настройках уведомлений — после входа.' }
    : !subscribed ? { title: 'Вы уже отписаны', text: 'Писем «Что нового на CanRush» больше не будет. Включить их снова можно в настройках уведомлений.' }
    : { title: 'Отписаться от писем?', text: 'Мы пишем, только если вы давно не заходили на CanRush, и не чаще раза в две недели: что нового на сайте и что вы пропустили. Письма о входе по-прежнему будут приходить.' };
  const ask = valid && subscribed && !one(params.done) && !one(params.error);
  return (
    <BrandShell headerAction={<ProfileNavigation active="profile" />}>
      <section className="auth-layout compact-layout">
        <p className="section-label">Письма CanRush</p>
        <h1>{copy.title}</h1>
        <p>{copy.text}</p>
        {ask
          ? <form action={unsubscribeAction} className="unsubscribe-form">
              <input type="hidden" name="u" value={user} />
              <input type="hidden" name="t" value={token} />
              <button className="primary-button" type="submit">Не присылать такие письма</button>
            </form>
          : <Link className="primary-link" href={SETTINGS}>Настройки уведомлений</Link>}
      </section>
    </BrandShell>
  );
}
