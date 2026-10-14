import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ProfileNavigation } from '@/components/profile-navigation';
import { SiteTabBar } from '@/components/site-tab-bar';
import { MarketTabs, StoreTabs } from '@/components/section-tabs';

function links(html: string) {
  return [...html.matchAll(/<a\s([^>]*)>/g)].map(([, attributes = '']) => ({
    href: /href="([^"]*)"/.exec(attributes)?.[1],
    current: /aria-current="([^"]*)"/.exec(attributes)?.[1],
    label: /aria-label="([^"]*)"/.exec(attributes)?.[1],
  }));
}

describe('site tab bar', () => {
  it('lists five sections; orders live inside the market', () => {
    const html = renderToStaticMarkup(createElement(SiteTabBar));
    expect(links(html).map(({ href }) => href)).toEqual(['/catalog', '/prices', '/tierlists', '/market', '/profile']);
    for (const label of ['Каталог', 'Магазины', 'Тирлисты', 'Маркет', 'Профиль']) expect(html).toContain(`>${label}</span>`);
    expect(html).not.toContain('/messages');
    expect(links(html).find(({ href }) => href === '/prices')?.label).toBe('Магазины и цены');
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

describe('section tabs', () => {
  it('puts orders into the market and hides private tabs from guests', () => {
    const guest = renderToStaticMarkup(createElement(MarketTabs, { active: 'all', signedIn: false }));
    expect(links(guest).map(({ href }) => href)).toEqual(['/market']);
    const member = renderToStaticMarkup(createElement(MarketTabs, { active: 'orders', signedIn: true }));
    expect(links(member).map(({ href }) => href)).toEqual(['/market', '/market?mine=1', '/messages']);
    expect(links(member).filter(({ current }) => current === 'page').map(({ href }) => href)).toEqual(['/messages']);
  });
  it('groups prices and stores under one section', () => {
    const html = renderToStaticMarkup(createElement(StoreTabs, { active: 'stores', signedIn: true }));
    expect(links(html).map(({ href }) => href)).toEqual(['/prices', '/market/stores', '/market/stores?mine=1']);
    expect(links(html).filter(({ current }) => current === 'page').map(({ href }) => href)).toEqual(['/market/stores']);
  });
});
