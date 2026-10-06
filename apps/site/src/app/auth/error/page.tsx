import type { Metadata } from 'next';
import Link from '@/components/navigation-progress';
import { BrandShell } from '@/components/brand-shell';
import { ProfileNavigation } from '@/components/profile-navigation';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Ссылка недействительна',
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
};

interface ErrorPageProps {
  searchParams: Promise<{ error?: string | string[] }>;
}

function errorCopy(error: string | undefined): { title: string; text: string } {
  if (error === 'INVALID_REQUEST') {
    return {
      title: 'Запрос остановлен',
      text: 'Не удалось подтвердить источник запроса. Откройте исходное письмо и попробуйте снова.',
    };
  }
  return {
    title: 'Ссылка больше не работает',
    text: 'Она могла истечь, уже использоваться или быть повреждена. Запросите новую ссылку для входа.',
  };
}

export default async function AuthErrorPage({ searchParams }: ErrorPageProps) {
  const errorValue = (await searchParams).error;
  const error = Array.isArray(errorValue) ? undefined : errorValue;
  const copy = errorCopy(error);

  return (
    <BrandShell headerAction={<ProfileNavigation active="profile" />}>
      <section className="auth-layout compact-layout">
        <p className="section-label">Безопасный вход</p>
        <h1>{copy.title}</h1>
        <p>{copy.text}</p>
        <Link className="primary-link" href="/sign-in">
          Получить новую ссылку
        </Link>
      </section>
    </BrandShell>
  );
}
