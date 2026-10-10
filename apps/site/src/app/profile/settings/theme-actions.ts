'use server';
import { cookies } from 'next/headers';
import { parseSiteTheme, SITE_THEME_COOKIE } from '@/lib/site-theme';
export async function saveThemeSettings(_previous: { error?: string; success?: string }, form: FormData): Promise<{ error?: string; success?: string }> {
  const theme = parseSiteTheme(form.get('theme'));
  if (!theme) return { error: 'Выберите светлую или графитовую тему.' };
  try {
    (await cookies()).set(SITE_THEME_COOKIE, theme, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax', httpOnly: true, secure: process.env.NODE_ENV === 'production' });
    return { success: 'Тема сохранена.' };
  } catch { return { error: 'Не удалось сохранить тему. Попробуйте ещё раз.' }; }
}
