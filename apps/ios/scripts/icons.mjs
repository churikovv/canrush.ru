// Рисует иконку приложения и заставку iOS из логотипа сайта (apps/site/src/app/icon.svg), как apps/android/scripts/icons.mjs.
// Растеризация — Chromium из Playwright, который уже стоит для парсера.
// Запуск: npm -w apps/ios run icons
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const assets = join(root, 'ios/App/App/Assets.xcassets');
const siteIcon = readFileSync(join(root, '../site/src/app/icon.svg'), 'utf8');
const logo = siteIcon.match(/<g[\s\S]*<\/g>/)?.[0];
if (!logo) throw new Error('В icon.svg нет группы с логотипом');
const logoPaths = logo.replace(/^<g[^>]*>/, '').replace(/<\/g>$/, '');

const BLUE = '#006eff';
// Логотип в icon.svg: translate(9 14) scale(2.7) внутри 64×64, исходный размер ≈ 17.3×12.5.
const mark = (cx, cy, width, fill) => {
  const scale = width / 17.3;
  return `<g transform="translate(${cx - width / 2} ${cy - (12.5 * scale) / 2}) scale(${scale})" fill="${fill}">${logoPaths}</g>`;
};
const svg = (size, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>`;

// iOS скругляет углы сам: иконка — полный квадрат без прозрачности. Тёмная и тонированная — для тем iOS 18+.
const ICON = 1024;
const icons = {
  'AppIcon.png': svg(ICON, `<rect width="${ICON}" height="${ICON}" fill="${BLUE}"/>${mark(ICON / 2, ICON / 2, ICON * 0.62, '#fff')}`),
  'AppIcon-dark.png': svg(ICON, mark(ICON / 2, ICON / 2, ICON * 0.62, BLUE)),
  'AppIcon-tinted.png': svg(ICON, `<rect width="${ICON}" height="${ICON}" fill="#000"/>${mark(ICON / 2, ICON / 2, ICON * 0.62, '#fff')}`),
};
// Заставка — квадрат, который LaunchScreen растягивает с обрезкой (aspect fill): знак в центре виден при любой форме
// экрана — iPhone, iPad в любой ориентации, внутренний экран iPhone Duo.
const SPLASH = 2732;
const splash = svg(SPLASH, `<rect width="${SPLASH}" height="${SPLASH}" fill="${BLUE}"/>${mark(SPLASH / 2, SPLASH / 2, SPLASH * 0.16, '#fff')}`);

const browser = await chromium.launch();
const page = await browser.newPage();
const render = async (markup, size, file, transparent) => {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block}</style>${markup}`);
  writeFileSync(file, await page.locator('svg').screenshot({ omitBackground: transparent }));
};

try {
  for (const [file, markup] of Object.entries(icons)) await render(markup, ICON, join(assets, 'AppIcon.appiconset', file), file === 'AppIcon-dark.png');
  for (const file of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) await render(splash, SPLASH, join(assets, 'Splash.imageset', file), false);
} finally {
  await browser.close();
}
writeFileSync(join(assets, 'AppIcon.appiconset/Contents.json'), `${JSON.stringify({
  images: [
    { filename: 'AppIcon.png', idiom: 'universal', platform: 'ios', size: '1024x1024' },
    { appearances: [{ appearance: 'luminosity', value: 'dark' }], filename: 'AppIcon-dark.png', idiom: 'universal', platform: 'ios', size: '1024x1024' },
    { appearances: [{ appearance: 'luminosity', value: 'tinted' }], filename: 'AppIcon-tinted.png', idiom: 'universal', platform: 'ios', size: '1024x1024' },
  ],
  info: { author: 'xcode', version: 1 },
}, null, 2)}\n`);
console.log('Иконка и заставка обновлены в', assets);
