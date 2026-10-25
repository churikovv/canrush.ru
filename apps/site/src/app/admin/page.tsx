import '@/styles/shared.css';
import '@/styles/profile.css';
import '@/styles/admin.css';
import { AdminCampaigns } from '@/components/admin-campaigns';
import type { Metadata } from 'next';
import Link from '@/components/navigation-progress';
import { BrandShell } from '@/components/brand-shell';
import { AdminDashboard } from '@/components/admin-dashboard';
import { requireSiteAdmin } from '@/lib/admin';
import { redirect } from 'next/navigation';
import { getAdminDashboardData } from '@/lib/admin-dashboard-data';
import { adminTab, adminPage } from '@/lib/admin-tabs';
import { normalizeAdminSearch } from '@/lib/admin-fields';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Управление сайтом',
  robots: { index: false, follow: false },
};

const NOTICES: Record<string, string> = {
  'report-reviewed': 'Статус жалобы обновлён.',
  'admin-added': 'Доступ к админ-панели выдан.',
  'admin-exists': 'Этот email уже есть в списке администраторов.',
  'admin-removed': 'Доступ к админ-панели удалён.',
  'role-changed': 'Роль изменена.',
  'user-blocked': 'Пользователь заблокирован.',
  'user-unblocked': 'Пользователь разблокирован.',
  'user-frozen': 'Участник заморожен: писать он не сможет до конца срока.',
  'user-unfrozen': 'Заморозка снята.',
  'tierlists-purged': 'Все тирлисты участника удалены.',
  'comments-purged': 'Все комментарии и записи участника удалены.',
  'user-deleted': 'Аккаунт участника удалён.',
};

const ERRORS: Record<string, string> = {
  'invalid-email': 'Введите корректный email администратора.',
  'protected-admin': 'Этот доступ защищён и не может быть удалён.',
  'invalid-target': 'Объект не найден или действие для него недоступно.',
  forbidden: 'Этот раздел доступен только администраторам.',
  'operation-failed': 'Не удалось выполнить действие. Обновите страницу и попробуйте снова.',
};

interface AdminPageProps {
  searchParams: Promise<{ q?: string; tab?: string; page?: string; notice?: string; error?: string; days?: string }>;
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const [admin, params] = await Promise.all([requireSiteAdmin(), searchParams]);
  const query = normalizeAdminSearch(params.q);
  const tab = adminTab(params.tab);
  // Moderators have no administrators and campaigns tabs; their tables show nicknames instead of emails.
  if (admin.role !== 'admin' && (tab === 'admins' || tab === 'campaigns')) redirect('/admin?error=forbidden');
  const data = await getAdminDashboardData(query, tab, adminPage(params.page), admin.role === 'admin');

  return (
    <BrandShell
      headerAction={<Link className="admin-back-link" href="/profile/settings">Вернуться в настройки</Link>}
      surfaceClassName="admin-surface"
    >
      <AdminDashboard
        campaignPanel={tab === 'campaigns' ? <AdminCampaigns days={[0,7,30,90].includes(Number(params.days)) ? Number(params.days) : 30} page={adminPage(params.page)} /> : undefined}
        admin={admin}
        data={data}
        tab={tab}
        query={query}
        notice={params.notice ? NOTICES[params.notice] : undefined}
        error={params.error ? ERRORS[params.error] : undefined}
      />
    </BrandShell>
  );
}
