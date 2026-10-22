// Рисует иконки лаунчера и заставку из логотипа сайта (apps/site/src/app/icon.svg).
// Растеризация — Chromium из Playwright, который уже стоит для парсера.
// Запуск: npm -w apps/android run icons
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const res = join(root, 'android/app/src/main/res');
const siteIcon = readFileSync(join(root, '../site/src/app/icon.svg'), 'utf8');
const logo = siteIcon.match(/<g[\s\S]*<\/g>/)?.[0];
if (!logo) throw new Error('В icon.svg нет группы с логотипом');
const logoPaths = logo.replace(/^<g[^>]*>/, '').replace(/<\/g>$/, '');

const BLUE = '#006eff';
// Логотип в icon.svg: translate(9 14) scale(2.7) внутри 64×64, исходный размер ≈ 17.3×12.5.
const mark = (cx, cy, width, fill) => {
  const scale = width / 17.3;
  const x = cx - width / 2;
  const y = cy - (12.5 * scale) / 2;
  return `<g transform="translate(${x} ${y}) scale(${scale})" fill="${fill}">${logoPaths}</g>`;
};
const svg = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

const icons = {
  // Старые лаунчеры (< Android 8): квадрат со скруглением, как на сайте.
  legacy: size => svg(size, size, `<rect width="${size}" height="${size}" rx="${size * 0.22}" fill="${BLUE}"/>${mark(size / 2, size / 2, size * 0.73, '#fff')}`),
  round: size => svg(size, size, `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="${BLUE}"/>${mark(size / 2, size / 2, size * 0.64, '#fff')}`),
  // Адаптивная иконка: 108dp, безопасная зона — круг 66dp в центре.
  foreground: size => svg(size, size, mark(size / 2, size / 2, size * 0.46, '#fff')),
  // Старые Android (до 12): синий экран с белым знаком, как системная заставка (res/drawable/splash_icon.xml).
  splash: (w, h) => svg(w, h, `<rect width="${w}" height="${h}" fill="${BLUE}"/>${mark(w / 2, h / 2, Math.min(w, h) * 0.3, '#fff')}`),
};

const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const splashes = {
  'drawable': [480, 320],
  'drawable-land-mdpi': [480, 320],
  'drawable-land-hdpi': [800, 480],
  'drawable-land-xhdpi': [1280, 720],
  'drawable-land-xxhdpi': [1600, 960],
  'drawable-land-xxxhdpi': [1920, 1280],
  'drawable-port-mdpi': [320, 480],
  'drawable-port-hdpi': [480, 800],
  'drawable-port-xhdpi': [720, 1280],
  'drawable-port-xxhdpi': [960, 1600],
  'drawable-port-xxxhdpi': [1280, 1920],
};

const browser = await chromium.launch();
const page = await browser.newPage();
const render = async (markup, w, h, file) => {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block}</style>${markup}`);
  writeFileSync(join(res, file), await page.locator('svg').screenshot({ omitBackground: true }));
};

try {
  for (const [name, k] of Object.entries(densities)) {
    const launcher = Math.round(48 * k);
    const adaptive = Math.round(108 * k);
    await render(icons.legacy(launcher), launcher, launcher, `mipmap-${name}/ic_launcher.png`);
    await render(icons.round(launcher), launcher, launcher, `mipmap-${name}/ic_launcher_round.png`);
    await render(icons.foreground(adaptive), adaptive, adaptive, `mipmap-${name}/ic_launcher_foreground.png`);
  }
  for (const [dir, [w, h]] of Object.entries(splashes)) {
    await render(icons.splash(w, h), w, h, `${dir}/splash.png`);
  }
} finally {
  await browser.close();
}
console.log('Иконки и заставка обновлены в', res);
