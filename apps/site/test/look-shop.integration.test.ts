import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';

const databaseUrl = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(databaseUrl).pathname !== '/canrush_site_test') throw new Error('Only canrush_site_test is allowed');
const pool = new Pool({ connectionString: databaseUrl, max: 4, allowExitOnIdle: true });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
const shop = await import('../src/lib/shop');
const { priceNow, shopItem } = await import('../src/lib/shop-items');
const { getProfileCommunity, setProfileTags } = await import('../src/lib/profile-community');
const { saveProfileCustomization } = await import('../src/lib/profile-images');

const member = randomUUID();
const username = `shop_${member.replaceAll('-', '').slice(0, 12)}`;
const input = { username, name: 'Shop test', telegramChannel: null, telegramUsername: null };
beforeAll(async () => {
  await pool.query(`insert into "user" (id, name, username, email, "emailVerified", "createdAt", "updatedAt") values ($1, 'Shop test', $2, $3, true, now(), now())`, [member, username, `${member}@example.com`]);
});
afterAll(async () => { await pool.query('delete from "user" where id = $1', [member]); await pool.end(); });

describe.sequential('look shop', () => {
  const now = new Date('2026-11-04T12:00:00+03:00');
  const price = (key: string) => priceNow(shopItem(key)!, now);
  it('counts sparks from achievements like the trophy score, from levels and from the week race', () => {
    expect(shop.trophyScore(['kitty', 'based', 'first-pull', 'admin', 'week-hero', 'unknown', 'kitty'])).toBe(10 + 50 + 10);
    // 1000 XP is level 5: four levels above the first.
    expect(shop.sparkEarnings(['kitty'], 1000, [1, 3, 8])).toEqual({ achievements: 10, levels: 60, race: 100 + 60 + 30 });
  });
  it('spends sparks once at today\'s price, refuses what is owned or too dear and items that do not exist', async () => {
    await pool.query(`insert into "profileAchievement" ("userId", key) values ($1, 'kitty'), ($1, 'flash'), ($1, 'based')`, [member]);
    // 1000 XP: +60 sparks for levels, 145 in all.
    await pool.query(`insert into "profileExperience" ("userId", reason, "sourceKey", points) values ($1, 'achievement', 'shop-test', 1000)`, [member]);
    expect(await shop.getShop(member)).toEqual({ earned: 145, sources: { achievements: 85, levels: 60, race: 0 }, spent: 0, balance: 145, owned: [] });
    await expect(shop.buyShopItem(member, 'monster', now)).rejects.toThrow('Такого товара нет');
    await expect(shop.buyShopItem(member, 'main', now)).rejects.toThrow(`Не хватает ${price('main') - 145} искр`);
    expect(await shop.buyShopItem(member, 'owl', now)).toMatchObject({ spent: price('owl'), balance: 145 - price('owl'), owned: ['owl'] });
    await expect(shop.buyShopItem(member, 'owl', now)).rejects.toThrow('Уже куплено');
    // Two taps at once cannot overspend: the balance is checked under the member's lock.
    const left = 145 - price('owl');
    expect(price('vibe') + price('crush')).toBeGreaterThan(left);
    expect(Math.max(price('vibe'), price('crush'))).toBeLessThanOrEqual(left);
    const results = await Promise.allSettled([shop.buyShopItem(member, 'vibe', now), shop.buyShopItem(member, 'crush', now)]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const after = await shop.getShop(member);
    expect(after.spent).toBe(price('owl') + price(after.owned[1]!));
  });
  it('lets the member wear what was bought: the tag next to the name', async () => {
    await expect(setProfileTags(member, ['sigma'])).rejects.toThrow('полученный');
    await setProfileTags(member, ['owl']);
    const community = await getProfileCommunity(member);
    expect(community.tags).toEqual(['owl']);
    expect(community.shopTags).toContain('owl');
    expect(community.earned).not.toContain('owl');
    await expect(saveProfileCustomization(member, input, {}, undefined, { theme: 'default', frame: 'aurora' })).rejects.toThrow();
  });
  it('lets the member wear a bought frame', async () => {
    await pool.query(`insert into "profileAchievement" ("userId", key) values ($1, 'six-seven'), ($1, 'streak-30') on conflict do nothing`, [member]);
    await shop.buyShopItem(member, 'bubbles', now);
    await saveProfileCustomization(member, input, {}, undefined, { theme: 'default', frame: 'bubbles' });
  });
  it('refuses blocked members', async () => {
    await pool.query('insert into "userBlock" ("userId") values ($1)', [member]);
    try { await expect(shop.buyShopItem(member, 'aurora', now)).rejects.toThrow('заблокирован'); }
    finally { await pool.query('delete from "userBlock" where "userId" = $1', [member]); }
  });
});
