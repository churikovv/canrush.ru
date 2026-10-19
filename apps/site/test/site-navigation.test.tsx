import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ProfileNavigation } from '@/components/profile-navigation';
import { SiteTabBar } from '@/components/site-tab-bar';
import { FeedTabs, MarketTabs, StoreTabs } from '@/components/section-tabs';

function links(html: string) {
  return [...html.matchAll(/<a\s([^>]*)>/g)].map(([, attributes = '']) => ({
    href: /href="([^"]*)"/.exec(attributes)?.[1],
    current: /aria-current="([^"]*)"/.exec(attributes)?.[1],
    label: /aria-label="([^"]*)"/.exec(attributes)?.[1],
  }));
}

describe('site tab bar', () => {
  it('has five tabs with search in the middle', () => {
    const html = renderToStaticMarkup(createElement(SiteTabBar, { signedIn: true }));
    expect(links(html).map(({ href }) => href)).toEqual(['/', '/calendar', '/search', '/community', '/profile']);
    for (const label of ['Главная', 'Календарь', 'Поиск', 'Сообщество', 'Профиль']) expect(html).toContain(`>${label}</span>`);
    expect(html).not.toContain('/messages');
    expect(html).not.toContain('aria-current');
    expect(html).not.toContain('/profile/favorites');
  });

  it('offers sign-in instead of the profile to guests', () => {
    const html = renderToStaticMarkup(createElement(SiteTabBar));
    expect(links(html).at(-1)?.href).toBe('/sign-in');
    expect(html).toContain('>Войти</span>');
    expect(html).not.toContain('>Профиль</span>');
  });

  it('marks the home tab on the homepage', () => {
    const html = renderToStaticMarkup(createElement(SiteTabBar, { active: 'home' }));
    expect(links(html).filter(({ current }) => current === 'page').map(({ href }) => href)).toEqual(['/']);
  });

  it('lights up search for the catalog, prices, stores and the market', () => {
    for (const active of ['search', 'catalog', 'prices', 'stores', 'market'] as const) {
      const html = renderToStaticMarkup(createElement(SiteTabBar, { active }));
      expect(links(html).filter(({ current }) => current === 'page').map(({ href }) => href)).toEqual(['/search']);
    }
  });

  it('marks only the active section as the current page', () => {
    const html = renderToStaticMarkup(createElement(SiteTabBar, { active: 'favorites', signedIn: true }));
    expect(links(html).filter(({ current }) => current === 'page').map(({ href }) => href)).toEqual(['/profile']);
  });

  it('lights up the community tab for tier lists and the feed', () => {
    for (const active of ['community', 'tierlists', 'feed'] as const) {
      const html = renderToStaticMarkup(createElement(SiteTabBar, { active }));
      expect(links(html).filter(({ current }) => current === 'page').map(({ href }) => href)).toEqual(['/community']);
    }
  });

  it('marks the feed in the header and the community in the tab bar', async () => {
    const html = renderToStaticMarkup(await ProfileNavigation({ active: 'feed', signedIn: true }));
    expect(links(html).filter(({ current }) => current === 'page').map(({ href }) => href)).toEqual(['/feed', '/community']);
  });

  it('renders the header buttons and the tab bar with the same active section', async () => {
    const html = renderToStaticMarkup(await ProfileNavigation({ active: 'calendar', signedIn: true }));
    const tabBarStart = html.indexOf('<nav class="site-tab-bar"');
    expect(html.indexOf('<nav class="profile-navigation"')).toBe(0);
    expect(tabBarStart).toBeGreaterThan(0);
    expect(html).not.toContain('/profile/favorites');
    expect(links(html.slice(tabBarStart)).filter(({ current }) => current === 'page').map(({ href }) => href)).toEqual(['/calendar']);
  });
});

describe('header menus', () => {
  it('groups the desktop header into community and stores menus plus the profile', async () => {
    const html = renderToStaticMarkup(await ProfileNavigation({ signedIn: true }));
    const header = html.slice(0, html.indexOf('<nav class="site-tab-bar"'));
    // Each group label links to its first page, then the panel lists every page of the group.
    expect(links(header).map(({ href }) => href)).toEqual(['/tierlists', '/tierlists', '/market', '/feed', '/catalog', '/catalog', '/prices', '/market/stores', '/profile']);
    for (const label of ['Сообщество', 'Магазины', 'Объявления', 'Тирлисты', 'Лента', 'Каталог', 'Цены', 'Найти']) expect(header).toContain(label);
    expect(header.match(/aria-expanded="false"/g)).toHaveLength(2);
  });

  it('marks the store finder in the header menu and search in the tab bar', async () => {
    const html = renderToStaticMarkup(await ProfileNavigation({ active: 'stores', signedIn: true }));
    const tabBarStart = html.indexOf('<nav class="site-tab-bar"');
    expect(links(html.slice(0, tabBarStart)).filter(({ current }) => current === 'page').map(({ href }) => href)).toEqual(['/market/stores']);
    expect(links(html.slice(tabBarStart)).filter(({ current }) => current === 'page').map(({ href }) => href)).toEqual(['/search']);
    expect(html.slice(0, tabBarStart).match(/data-current="true"/g)).toHaveLength(1);
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
  it('hides the following feed from guests', () => {
    const guest = renderToStaticMarkup(createElement(FeedTabs, { active: 'all', signedIn: false }));
    expect(links(guest).map(({ href }) => href)).toEqual(['/feed']);
    const member = renderToStaticMarkup(createElement(FeedTabs, { active: 'following', signedIn: true }));
    expect(links(member).filter(({ current }) => current === 'page').map(({ href }) => href)).toEqual(['/feed?scope=following']);
  });
  it('groups prices and stores under one section', () => {
    const html = renderToStaticMarkup(createElement(StoreTabs, { active: 'stores', signedIn: true }));
    expect(links(html).map(({ href }) => href)).toEqual(['/prices', '/market/stores', '/market/stores?mine=1']);
    expect(links(html).filter(({ current }) => current === 'page').map(({ href }) => href)).toEqual(['/market/stores']);
  });
});
