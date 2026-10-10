'use client';
import { AvatarFrame } from '@/components/avatar-frame';
import { PROFILE_THEMES, PROFILE_FRAMES, DEFAULT_PROFILE_APPEARANCE, type ProfileAppearance } from '@/lib/profile-appearance';

export function ProfileAppearanceEditor({ value, onChange, disabled, level, current }: { level: number; current: ProfileAppearance; value: ProfileAppearance; onChange: (value: ProfileAppearance) => void; disabled: boolean }) {
  return <section className="profile-appearance-editor" aria-labelledby="appearance-title">
    <div className="community-section-heading"><h2 id="appearance-title">Оформление</h2><button type="button" className="community-button community-button-secondary" disabled={disabled} onClick={() => onChange(DEFAULT_PROFILE_APPEARANCE)}>Сбросить оформление</button></div>
    <p className="community-section-note">Цвет и рамка видны всем посетителям. Шапка сверху показывает ваш выбор до сохранения.</p>
    <p className="appearance-level-status">Ваш уровень: <strong>{level}</strong> · Новое оформление открывается с ростом уровня.</p>
    <fieldset disabled={disabled} className="appearance-options"><legend>Цвет профиля</legend>
      <div className="appearance-theme-options">{PROFILE_THEMES.map(theme => <label key={theme.key} className="appearance-option">
        <input type="radio" name="profile-theme-choice" value={theme.key} disabled={level < theme.level && current.theme !== theme.key} checked={value.theme === theme.key} onChange={() => onChange({ ...value, theme: theme.key })} />
        <span className="appearance-swatch" data-profile-theme={theme.key} aria-hidden="true"><i /><i /><i /></span>
        <strong>{theme.label}</strong><span>{theme.description}</span><UnlockStatus required={theme.level} level={level} equipped={current.theme === theme.key} />
      </label>)}</div>
    </fieldset>
    <fieldset disabled={disabled} className="appearance-options"><legend>Рамка аватарки</legend>
      <div className="appearance-frame-options">{PROFILE_FRAMES.map(frame => <label key={frame.key} className="appearance-option">
        <input type="radio" name="profile-frame-choice" value={frame.key} disabled={level < frame.level && current.frame !== frame.key} checked={value.frame === frame.key} onChange={() => onChange({ ...value, frame: frame.key })} />
        <span className="appearance-frame-sample community-avatar" data-frame={frame.key} aria-hidden="true">C<AvatarFrame frame={frame.key} /></span><strong>{frame.label}</strong><UnlockStatus required={frame.level} level={level} equipped={current.frame === frame.key} />
      </label>)}</div>
      <p className="community-section-note">Анимация отключается, если на устройстве включено уменьшение движения.</p>
    </fieldset>
  </section>;
}

function UnlockStatus({ required, level, equipped }: { required: number; level: number; equipped: boolean }) {
  const locked = level < required && !equipped;
  return <span className="appearance-unlock-status">{locked && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>}{locked ? `Откроется на уровне ${required}` : required === 1 ? 'Доступно всем' : equipped && level < required ? 'Уже установлено' : `Открыто · уровень ${required}`}</span>;
}
