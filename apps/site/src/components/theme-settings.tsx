'use client';
import { useActionState } from 'react';
import { saveThemeSettings } from '@/app/profile/settings/theme-actions';
import type { SiteTheme } from '@/lib/site-theme';

export function ThemeSettings({ theme }: { theme: SiteTheme }) {
  const [state, action, pending] = useActionState(saveThemeSettings, {});
  return <section className="community-panel theme-settings" aria-labelledby="theme-settings-title">
    <h2 id="theme-settings-title">Тема сайта</h2>
    <p className="community-section-note">Системная тема следует настройкам устройства. Выбор сохраняется в этом браузере. Цвета, выбранные автором профиля, остаются его оформлением.</p>
    <form action={action}>
      <div className="site-theme-options">{([{ key: 'system', label: 'Системная' }, { key: 'light', label: 'Светлая' }, { key: 'graphite', label: 'Тёмная' }] as const).map(item =>
        <button key={item.key} type="submit" name="theme" value={item.key} disabled={pending} aria-pressed={theme === item.key} className="site-theme-choice">
          <span className="site-theme-sample" data-sample-theme={item.key} aria-hidden="true"><i /><span><b /><b /><b /></span></span>
          <span>{item.label}<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg></span>
        </button>)}</div>
      <p role={state.error ? 'alert' : 'status'} className={state.error ? 'field-error' : 'theme-save-status'}>{pending ? 'Применяем тему…' : state.error ?? state.success}</p>
    </form>
  </section>;
}
