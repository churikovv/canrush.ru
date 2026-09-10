import type { Metadata } from 'next';
import Link from 'next/link';
import { BrandShell } from '@/components/brand-shell';
import { AdminDashboard } from '@/components/admin-dashboard';
import { getAdminDashboardData, requireSiteAdmin } from '@/lib/admin';
import { normalizeAdminSearch } from '@/lib/admin-fields';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Управление сайтом',
  robots: { index: false, follow: false },
};

const NOTICES: Record<string, string> = {
  'admin-added': 'Администратор добавлен.',
  'admin-exists': 'Этот email уже есть в списке администраторов.',
  'admin-removed': 'Доступ администратора удалён.',
  'user-blocked': 'Пользователь заблокирован.',
  'user-unblocked': 'Пользователь разблокирован.',
  'tierlist-deleted': 'Тирлист удалён.',
  'review-deleted': 'Отзыв удалён.',
};

const ERRORS: Record<string, string> = {
  'invalid-email': 'Введите корректный email администратора.',
  'protected-admin': 'Этот доступ защищён и не может быть удалён.',
  'invalid-target': 'Объект не найден или действие для него недоступно.',
  'operation-failed': 'Не удалось выполнить действие. Обновите страницу и попробуйте снова.',
};

interface AdminPageProps {
  searchParams: Promise<{ q?: string; notice?: string; error?: string }>;
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const [admin, params] = await Promise.all([requireSiteAdmin(), searchParams]);
  const query = normalizeAdminSearch(params.q);
  const data = await getAdminDashboardData(query);

  return (
    <BrandShell
      headerAction={<Link className="admin-back-link" href="/profile">Вернуться в профиль</Link>}
      surfaceClassName="admin-surface"
    >
      <AdminDashboard
        admin={admin}
        data={data}
        query={query}
        notice={params.notice ? NOTICES[params.notice] : undefined}
        error={params.error ? ERRORS[params.error] : undefined}
      />
    </BrandShell>
  );
}
