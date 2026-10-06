import type { Metadata } from 'next';
import Link from '@/components/navigation-progress';
import { BrandShell } from '@/components/brand-shell';
import { ProfileNavigation } from '@/components/profile-navigation';
import { isMagicLinkToken } from '@/lib/magic-link-url';
import { MagicLinkAutoConfirm } from '@/components/magic-link-auto-confirm';

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
    <BrandShell headerAction={<ProfileNavigation active="profile" />}>
      <section className="auth-layout compact-layout">
        <p className="section-label">Проверка ссылки</p>
        <h1>{validToken ? 'Входим в профиль…' : 'Ссылка не подходит'}</h1>
        <p>
          {validToken
            ? 'Ссылка проверяется. Через мгновение откроется ваш профиль.'
            : 'Ссылка повреждена или скопирована не полностью. Запросите новое письмо.'}
        </p>
        {validToken ? (
          <MagicLinkAutoConfirm token={token!} />
        ) : (
          <Link className="primary-link" href="/sign-in">
            Запросить новую ссылку
          </Link>
        )}
      </section>
    </BrandShell>
  );
}
