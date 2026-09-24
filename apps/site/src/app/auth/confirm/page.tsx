import type { Metadata } from 'next';
import Link from 'next/link';
import { BrandShell } from '@/components/brand-shell';
import { ProfileNavigation } from '@/components/profile-navigation';
import { isMagicLinkToken } from '@/lib/magic-link-url';
import { confirmMagicLink } from './actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Подтверждение входа',
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
};

interface ConfirmPageProps {
  searchParams: Promise<{ token?: string | string[] }>;
}

export default async function ConfirmPage({ searchParams }: ConfirmPageProps) {
  const tokenValue = (await searchParams).token;
  const token = Array.isArray(tokenValue) ? undefined : tokenValue;
  const validToken = isMagicLinkToken(token);

  return (
    <BrandShell headerAction={<ProfileNavigation />}>
      <section className="auth-layout compact-layout">
        <p className="section-label">Проверка ссылки</p>
        <h1>{validToken ? 'Подтвердите вход' : 'Ссылка не подходит'}</h1>
        <p>
          {validToken
            ? 'Нажмите кнопку, чтобы завершить вход. До этого момента одноразовая ссылка не используется.'
            : 'Ссылка повреждена или скопирована не полностью. Запросите новое письмо.'}
        </p>
        {validToken ? (
          <form action={confirmMagicLink}>
            <input type="hidden" name="token" value={token} />
            <button className="primary-button" type="submit">
              Войти в CanRush
            </button>
          </form>
        ) : (
          <Link className="primary-link" href="/sign-in">
            Запросить новую ссылку
          </Link>
        )}
      </section>
    </BrandShell>
  );
}
