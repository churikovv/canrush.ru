import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ProfileNavigation } from '@/components/profile-navigation';
import { SiteTabBar } from '@/components/site-tab-bar';

function links(html: string) {
  return [...html.matchAll(/<a\s([^>]*)>/g)].map(([, attributes = '']) => ({
    href: /href="([^"]*)"/.exec(attributes)?.[1],
    current: /aria-current="([^"]*)"/.exec(attributes)?.[1],
    label: /aria-label="([^"]*)"/.exec(attributes)?.[1],
  }));
}

describe('site tab bar', () => {
  it('lists six sections with market and messages instead of home', () => {
    const html = renderToStaticMarkup(createElement(SiteTabBar));
    expect(links(html).map(({ href }) => href)).toEqual(['/catalog', '/prices', '/tierlists', '/market', '/messages', '/profile']);
    for (const label of ['Каталог', 'Цены', 'Тирлисты', 'Маркет', 'Сообщения', 'Профиль']) expect(html).toContain(`>${label}</span>`);
    expect(links(html).find(({ href }) => href === '/prices')?.label).toBe('Цены по магазинам');
    expect(html).not.toContain('aria-current');
    expect(html).not.toContain('/profile/favorites');
  });

  it('does not mark an unrelated tab on the homepage', () => {
    const html = renderToStaticMarkup(createElement(SiteTabBar, { active: 'home' }));
    expect(links(html).filter(({ current }) => current === 'page').map(({ href }) => href)).toEqual([]);
  });

  it('marks only the active section as the current page', () => {
    const html = renderToStaticMarkup(createElement(SiteTabBar, { active: 'favorites' }));
    expect(links(html).filter(({ current }) => current === 'page').map(({ href }) => href)).toEqual(['/profile']);
  });

  it('renders the header buttons and the tab bar with the same active section', () => {
    const html = renderToStaticMarkup(createElement(ProfileNavigation, { active: 'tierlists' }));
    const tabBarStart = html.indexOf('<nav class="site-tab-bar"');
    expect(html.indexOf('<nav class="profile-navigation"')).toBe(0);
    expect(tabBarStart).toBeGreaterThan(0);
    expect(html).not.toContain('/profile/favorites');
    for (const part of [html.slice(0, tabBarStart), html.slice(tabBarStart)]) {
      expect(links(part).filter(({ current }) => current === 'page').map(({ href }) => href)).toEqual(['/tierlists']);
    }
  });
});
