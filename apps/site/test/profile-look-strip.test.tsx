import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { ProfileImageMenu, ProfileLookStrip, type LookImage } from '@/components/profile-look-strip';
import { experienceForLevel, experienceLevel } from '@/lib/experience-level';
import { nextAppearanceUnlock, type ProfileAppearance } from '@/lib/profile-appearance';

const none: LookImage = { src: null, changed: false, removed: false };
const noop = () => {};
const render = (options: { level?: number; xp?: number; value?: ProfileAppearance; saved?: ProfileAppearance; owned?: string[]; brandFrames?: { key: string; reviewed: number }[]; tag?: { value: string; saved: string; earned: string[] } } = {}) => {
  const saved = options.saved ?? { theme: 'default', frame: 'none' };
  return renderToStaticMarkup(createElement(ProfileLookStrip, {
    appearance: options.value ?? saved, saved, onAppearance: noop, level: options.level ?? 1, xp: options.xp ?? 0,
    owned: options.owned ?? [], brandFrames: (options.brandFrames ?? []) as never,
    avatarSrc: null,
    tag: options.tag && { ...options.tag, onChange: noop, href: '/profile/tester/achievements' },
    blocks: { shown: 7, total: 12, open: noop }, disabled: false,
  }));
};

it('finds the nearest level that opens cosmetics and the XP it starts at', () => {
  expect(nextAppearanceUnlock(6)).toEqual({ level: 8, themes: ['Золото'], frames: ['Nya desuu'] });
  expect(nextAppearanceUnlock(4)).toEqual({ level: 5, themes: [], frames: ['Разряд', 'Бездна'] });
  expect(nextAppearanceUnlock(20)).toBeNull();
  for (const level of [1, 2, 8, 20]) expect(experienceLevel(experienceForLevel(level)).level).toBe(level);
});

it('shows one tile per part of the look, with the current choice and empty tiles for what is not set', () => {
  const html = render({ tag: { value: '', saved: '', earned: ['kitty'] } });
  expect(html).toContain('aria-label="Внешний вид профиля"');
  for (const label of ['Рамка', 'Фон', 'Тег', 'Блоки']) expect(html).toContain(`>${label}<`);
  // Avatar and banner change by the pencil on the preview, not in the strip.
  expect(html).not.toContain('data-look="avatar"');
  expect(html).not.toContain('data-look="banner"');
  expect(html).toMatch(/data-look="frame"[^]*?data-empty="true"[^]*?Без рамки/);
  expect(html).toContain('7 из 12');
  // A tile the member changed and has not saved yet carries a dot.
  expect(render({ value: { theme: 'mint', frame: 'none' } })).toMatch(/data-look="theme"[^]*?look-tile-dot/);
  expect(render()).not.toContain('look-tile-dot');
});

it('lists themes and frames above the level as locked, with the next unlock and the XP left', () => {
  const html = render({ level: 6, xp: 1700 });
  expect(html).toContain('откроет фон «Золото» и рамку «Nya desuu»');
  expect(html).toContain(`ещё ${(experienceForLevel(8) - 1700).toLocaleString('ru-RU')} XP`);
  expect(html).toMatch(/disabled=""[^>]*><span class="appearance-swatch" data-profile-theme="legend"[^]*?ещё 14 уровней/);
  expect(html).not.toMatch(/disabled=""[^>]*><span class="appearance-swatch" data-profile-theme="mint"/);
});

it('keeps an equipped cosmetic selectable after the level requirement changes', () => {
  const html = render({ saved: { theme: 'legend', frame: 'none' } });
  expect(html).toMatch(/role="radio" aria-checked="true" class="look-option"><span class="appearance-swatch" data-profile-theme="legend"/);
});

it('puts open brand frames among the frames and shows locked ones with how to open them', () => {
  const html = render({ owned: ['monster'], brandFrames: [{ key: 'monster', reviewed: 6 }, { key: 'burn', reviewed: 2 }] });
  expect(html).toMatch(/role="radio"[^>]*><span class="appearance-frame-sample community-avatar" data-frame="monster"/);
  expect(html).not.toMatch(/role="radio"[^>]*><span class="appearance-frame-sample community-avatar" data-frame="burn"/);
  expect(html).toMatch(/href="\/catalog\?brand=Burn"[^]*?Оцените 5 разных вкусов Burn[^]*?2 \/ 5/);
});

it('offers only earned tags, and «Без тега»', () => {
  const html = render({ tag: { value: 'kitty', saved: '', earned: ['kitty'] } });
  expect(html).toContain('Без тега');
  expect(html).toMatch(/aria-checked="true"[^]*?data-tag="kitty"/);
  expect(html).not.toContain('data-tag="date"');
  expect(html).toMatch(/data-look="tag"[^]*?look-tile-dot/);
  expect(html).toContain('href="/profile/tester/achievements"');
});

it('gives the pencil of a set picture a list: another photo, recrop, remove, undo once changed', () => {
  const menu = (image: LookImage) => renderToStaticMarkup(createElement(ProfileImageMenu, { kind: 'avatar', image, disabled: false, onPick: noop, onCrop: noop, onRemove: noop, onUndo: noop }));
  const html = menu({ src: '/api/profile-images/a', changed: false, removed: false });
  expect(html).toContain('aria-label="Изменить аватар"');
  expect(html).toContain('Загрузить другое фото');
  expect(html).toContain('Изменить кадр');
  expect(html).toContain('Удалить аватар');
  expect(html).not.toContain('Вернуть как было');
  // A removed picture can be uploaded again or brought back.
  const removed = menu({ ...none, changed: true, removed: true });
  expect(removed).toContain('Загрузить фото');
  expect(removed).toContain('Вернуть как было');
  expect(removed).not.toContain('Изменить кадр');
});
