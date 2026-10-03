export const ADMIN_TABS = [
  { key: 'analytics', label: 'Аналитика' },
  { key: 'users', label: 'Участники' },
  { key: 'tierlists', label: 'Тирлисты' },
  { key: 'reviews', label: 'Отзывы' },
  { key: 'wall', label: 'Стена' },
  { key: 'admins', label: 'Администраторы' },
] as const;
export type AdminTab = typeof ADMIN_TABS[number]['key'];
export function adminTab(value: unknown): AdminTab {
  return ADMIN_TABS.find(tab => tab.key === value)?.key ?? 'analytics';
}
export function adminPage(value: unknown): number {
  const page = typeof value === 'string' || typeof value === 'number' ? Number(value) : NaN;
  return Number.isSafeInteger(page) && page > 0 && page <= 100000 ? page : 1;
}
export function adminHref(tab: AdminTab, query = '', page = 1): string {
  const params = new URLSearchParams({ tab });
  if (query) params.set('q', query);
  if (page > 1) params.set('page', String(page));
  return `/admin?${params}`;
}
