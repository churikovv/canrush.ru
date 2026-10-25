/**
 * Roles in the admin panel. `admin` runs the whole panel; `moderator` handles requests (stores, drinks, reports),
 * deletes content, blocks members and sees analytics, without members' emails, administrators, contests, campaigns and
 * store transfers. No database code here, so components may import it.
 */
export type SiteRole = 'admin' | 'moderator';
export const SITE_ROLE_LABELS: Record<SiteRole, string> = { admin: 'Администратор', moderator: 'Модератор' };
