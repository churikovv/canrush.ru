import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { ProfileAppearanceEditor } from '@/components/profile-appearance-editor';
import { experienceForLevel, experienceLevel } from '@/lib/experience-level';
import { nextAppearanceUnlock } from '@/lib/profile-appearance';

const render = (level: number, xp: number, current = { theme: 'default', frame: 'none' } as const) =>
  renderToStaticMarkup(createElement(ProfileAppearanceEditor, { level, xp, current, value: current, onChange: () => {}, disabled: false }));

it('finds the nearest level that opens cosmetics and the XP it starts at', () => {
  expect(nextAppearanceUnlock(6)).toEqual({ level: 8, themes: ['Золото'], frames: ['Nya desuu'] });
  expect(nextAppearanceUnlock(4)).toEqual({ level: 5, themes: [], frames: ['Разряд', 'Бездна'] });
  expect(nextAppearanceUnlock(20)).toBeNull();
  for (const level of [1, 2, 8, 20]) expect(experienceLevel(experienceForLevel(level)).level).toBe(level);
});

it('shows the rank, the next unlock with remaining XP and locks themes above the level', () => {
  const html = render(6, 1700);
  expect(html).toContain('Уровень 6');
  expect(html).toContain('откроет тему «Золото» и рамку «Nya desuu»');
  expect(render(4, 900)).toContain('откроет рамку «Разряд» и рамку «Бездна»');
  expect(html).toContain(`Ещё ${(experienceForLevel(8) - 1700).toLocaleString('ru-RU')} XP`);
  expect(html).toContain('Темы 4 из 10');
  expect(html).toMatch(/disabled=""[^>]*><span class="appearance-swatch" data-profile-theme="legend"[^]*?ещё 14 уровней/);
  expect(html).not.toMatch(/disabled=""[^>]*><span class="appearance-swatch" data-profile-theme="mint"/);
});

it('keeps an equipped cosmetic selectable after the level requirement changes', () => {
  const html = render(1, 0, { theme: 'legend', frame: 'none' } as never);
  expect(html).toMatch(/aria-checked="true" class="appearance-choice"><span class="appearance-swatch" data-profile-theme="legend"/);
  expect(html).toContain('Темы 1 из 10');
});
