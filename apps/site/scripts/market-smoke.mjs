import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';
import { betterAuth } from 'better-auth';
import { magicLink } from 'better-auth/plugins';
import pg from 'pg';
import sharp from 'sharp';

const origin = 'http://localhost:3100';
const pool = new pg.Pool({ connectionString: 'postgresql://localhost:5432/canrush_site_test', max: 2 });
const secret = 'canrush-market-browser-test-secret-32-bytes';
const users = [];
let token = '';
const auth = betterAuth({ baseURL: origin, secret, database: pool, advanced: { useSecureCookies: false }, plugins: [magicLink({ storeToken: 'hashed', sendMagicLink: async data => { token = data.token; } })] });
const browser = await chromium.launch();
const errors = [];
async function person(name) {
  const email = `market-smoke-${randomUUID()}@example.com`;
  await auth.handler(new Request(`${origin}/api/auth/sign-in/magic-link`, { method: 'POST', headers: { 'Content-Type': 'application/json', origin }, body: JSON.stringify({ email }) }));
  const response = await auth.handler(new Request(`${origin}/api/auth/magic-link/verify?token=${encodeURIComponent(token)}&callbackURL=/profile`));
  const cookie = response.headers.get('set-cookie')?.split(';')[0]; assert(cookie);
  const split = cookie.indexOf('=');
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addCookies([{ name: cookie.slice(0, split), value: cookie.slice(split + 1), url: origin }]);
  const result = await pool.query('update "user" set name=$2 where email=$1 returning id', [email, name]); users.push(result.rows[0].id);
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${origin}/profile`);
  const accept = page.getByRole('button', { name: 'Принять и закрыть' }); if (await accept.isVisible()) await accept.click();
  return page;
}
try {
  const seller = await person('Продавец теста');
  await seller.goto(`${origin}/market/new`);
  await seller.getByRole('heading', { name: 'Новое объявление', exact: true }).waitFor();
  await seller.waitForTimeout(500);
  const sellerConsent = seller.getByRole('button', { name: 'Принять и закрыть' }); if (await sellerConsent.isVisible()) await sellerConsent.click();
  const buffer = await sharp({ create: { width: 800, height: 1000, channels: 3, background: '#006eff' } }).png().toBuffer();
  await seller.locator('input[type=file]').setInputFiles([{ name: 'test.png', mimeType: 'image/png', buffer }, { name: 'test2.png', mimeType: 'image/png', buffer }]);
  await seller.getByRole('button', { name: 'Обрезать фото 1', exact: true }).click();
  await seller.getByRole('button', { name: 'Применить', exact: true }).click();
  // Photos reorder with the arrow keys on a focused tile.
  await seller.getByLabel(/^Фотография 2\./).press('ArrowLeft');
  await seller.getByLabel(/^Фотография 1, обложка/).waitFor();
  await seller.getByLabel('Название объявления', { exact: true }).fill('Набор редких энергетиков');
  await seller.getByRole('combobox', { name: 'Бренд' }).fill('Разные');
  await seller.getByRole('option', { name: 'Разные бренды' }).click();
  await seller.getByLabel('Описание', { exact: true }).fill('Три банки из коллекции. Срок годности до декабря. Упакую каждую банку отдельно.');
  for (const name of ['Самовывоз', 'Яндекс', 'Авито', 'Сдэк', 'Почта России', 'X5 Post']) await seller.getByLabel(name, { exact: true }).check();
  await seller.getByLabel('Город', { exact: true }).fill('Москва');
  await seller.getByLabel('Количество, шт.').fill('6');
  await seller.getByLabel('Цена за одну банку, ₽').fill('1200,50');
  await seller.screenshot({ path: '/tmp/canrush-market-form.png', fullPage: true });
  await seller.getByRole('button', { name: 'Опубликовать объявление' }).click();
  await seller.waitForURL(/\/market\/[0-9a-f-]+$/);
  await seller.locator('.market-gallery').waitFor();
  const listingUrl = seller.url();
  assert.equal(await seller.getByRole('button', { name: /^Заказать/ }).count(), 0);
  await seller.screenshot({ path: '/tmp/canrush-market-detail.png', fullPage: true });
  const buyer = await person('Покупатель теста');
  await buyer.goto(listingUrl);
  await buyer.locator('.market-gallery').waitFor();
  const buyerConsent = buyer.getByRole('button', { name: 'Принять и закрыть' }); if (await buyerConsent.isVisible()) await buyerConsent.click();
  await buyer.locator('.market-order-quantity input').fill('2');
  await buyer.getByRole('button', { name: /^Заказать/ }).click();
  await buyer.waitForURL(/\/messages\/[0-9a-f-]+$/);
  const orderUrl = buyer.url();
  await buyer.locator('.market-order-card').waitFor();
  assert.match(await buyer.locator('.market-order-card').innerText(), /2 шт\./);
  const listingId = listingUrl.split('/').at(-1);
  assert.equal((await pool.query('select quantity from "marketListing" where id=$1', [listingId])).rows[0].quantity, 4);
  await buyer.getByLabel('Сообщение', { exact: true }).fill('Здравствуйте! Набор ещё в наличии?');
  await buyer.getByRole('button', { name: 'Прикрепить фотографии' }).click();
  await buyer.locator('input[type=file]').setInputFiles({ name: 'message.png', mimeType: 'image/png', buffer });
  await buyer.getByRole('button', { name: 'Отправить сообщение' }).click();
  await buyer.locator('.market-message').first().waitFor();
  await seller.goto(orderUrl);
  await seller.getByRole('button', { name: 'Подтвердить заказ', exact: true }).click();
  await buyer.reload();
  await buyer.getByRole('button', { name: 'Подтвердить получение' }).click();
  await buyer.getByRole('button', { name: 'Да, банки получены' }).click();
  await buyer.getByText('Завершён', { exact: true }).first().waitFor();
  await buyer.screenshot({ path: '/tmp/canrush-market-chat.png', fullPage: true });
  const attachment = await buyer.locator('.market-message-photos a').first().getAttribute('href');
  const anonymous = await browser.newContext();
  assert.equal((await anonymous.request.get(origin + attachment)).status(), 404);
  assert.equal((await buyer.request.get(origin + attachment)).status(), 200);
  await pool.query('update "user" set "lastMarketOrderAt"=null where id=$1', [users[1]]);
  await buyer.goto(listingUrl);
  await buyer.locator('.market-order-quantity input').fill('1');
  await buyer.getByRole('button', { name: /^Заказать/ }).click();
  await buyer.waitForURL(/\/messages\/[0-9a-f-]+$/);
  assert.notEqual(buyer.url(), orderUrl);
  await buyer.getByRole('button', { name: 'Отменить заказ', exact: true }).click();
  await buyer.getByRole('button', { name: 'Да, отменить заказ', exact: true }).click();
  await buyer.getByText('Отменён', { exact: true }).first().waitFor();
  assert.equal((await pool.query('select quantity from "marketListing" where id=$1', [listingId])).rows[0].quantity, 4);
  const publicPage = await anonymous.newPage();
  for (const width of [320, 390, 768, 1024, 1440]) {
    await publicPage.setViewportSize({ width, height: 900 }); await publicPage.goto(`${origin}/market`);
    await publicPage.locator('.market-card').first().waitFor();
    const accept = publicPage.getByRole('button', { name: 'Принять и закрыть' }); if (await accept.isVisible()) await accept.click();
    assert.equal(await publicPage.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Overflow at ${width}`);
    if (width === 390 || width === 1440) await publicPage.screenshot({ path: `/tmp/canrush-market-${width}.png`, fullPage: true });
  }
  // The loading screen covers slow client navigations only (no loading.tsx): start on a page that does not
  // read listings, hold the listings table, then switch search to the market.
  await publicPage.setViewportSize({ width: 390, height: 844 });
  await publicPage.goto(`${origin}/search`);
  await publicPage.locator('.search-scopes a[href="/search?type=market"]').waitFor();
  const blocker = await pool.connect();
  try {
    await blocker.query('begin');
    await blocker.query('lock table "marketListing" in access exclusive mode');
    await publicPage.locator('.search-scopes a[href="/search?type=market"]').click();
    await publicPage.locator('.site-loading:visible').waitFor();
    await publicPage.waitForFunction(() => [...document.querySelectorAll('.site-loading-grid rect')].some(element => element.getAnimations().length > 0));
    const initial = await publicPage.locator('.site-loading:visible .site-loading-grid rect').evaluateAll(elements => elements.map(element => getComputedStyle(element).transform));
    await publicPage.waitForTimeout(1200);
    const moved = await publicPage.locator('.site-loading:visible .site-loading-grid rect').evaluateAll(elements => elements.map(element => getComputedStyle(element).transform));
    assert.notDeepEqual(initial, moved);
    await publicPage.screenshot({ path: '/tmp/canrush-loading.png' });
    await publicPage.emulateMedia({ reducedMotion: 'reduce' });
    await publicPage.waitForFunction(() => [...document.querySelectorAll('.site-loading-grid rect')].every(element => element.getAnimations().length === 0));
    await publicPage.screenshot({ path: '/tmp/canrush-loading-reduced.png' });
    assert.equal(await publicPage.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  } finally { await blocker.query('rollback'); blocker.release(); }
  await publicPage.locator('.market-card').first().waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS: create, crop, reorder, quantity, reserve, cancel, repurchase, photo message, complete, private attachments, responsive widths 320–1440, animated loading on slow navigation and reduced motion.');
} finally {
  await browser.close();
  if (users.length) await pool.query('delete from "user" where id=any($1::text[])', [users]);
  await pool.end();
}
