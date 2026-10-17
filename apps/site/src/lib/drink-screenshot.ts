/** Month summary of the drink calendar drawn on a canvas, for the same preview dialog as tier lists. */
export interface DrinkSummaryShot {
  title: string;
  author: string;
  cans: number;
  days: number;
  monthDays: number;
  unique: number;
  best: number;
  top: { name: string; count: number } | null;
  /** Kopecks; null when spending is not shown. */
  spent: number | null;
  weeks: (string | null)[][];
  counts: Record<string, number>;
  streakDays: string[];
}

const BLUE = '#006efe';
const HEAT = ['#eef1f5', '#bcd8ff', '#6aa8ff', '#2a84ff', '#0050c0'];
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Не удалось подготовить изображение. Попробуйте ещё раз.'));
    image.src = src;
  });
}

/** The mascot already drawn on the page, serialised without its animations. */
async function birdImage(): Promise<HTMLImageElement | null> {
  const svg = document.querySelector<SVGSVGElement>('.drink-calendar-hero .drink-bird');
  if (!svg) return null;
  const copy = svg.cloneNode(true) as SVGSVGElement;
  copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  copy.setAttribute('width', '600'); copy.setAttribute('height', '600');
  return loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(copy))}`).catch(() => null);
}

function fit(ctx: CanvasRenderingContext2D, text: string, width: number): string {
  let value = text;
  while (ctx.measureText(value).width > width && value.length > 1) value = `${value.slice(0, -2)}…`;
  return value;
}

const rubles = (kopecks: number) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(kopecks / 100);
const plural = (count: number, one: string, few: string, many: string) => {
  const a = count % 10, b = count % 100;
  return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many;
};

async function draw(data: DrinkSummaryShot, width: number, height: number): Promise<Blob> {
  await document.fonts.ready;
  const family = getComputedStyle(document.body).fontFamily;
  const [bird, logo] = await Promise.all([birdImage(), loadImage('/brand/logo-mark-white.svg').catch(() => null)]);
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Не удалось создать изображение.');
  const pad = 72, story = height / width > 1.5;
  ctx.fillStyle = BLUE; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = 'rgb(255 255 255 / .08)';
  ctx.beginPath(); ctx.arc(width - 120, 180, 320, 0, Math.PI * 2); ctx.fill();

  // Header: title, author, logo.
  ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#fff';
  ctx.font = `800 ${story ? 84 : 72}px ${family}`;
  let y = pad + (story ? 120 : 64);
  ctx.fillText(fit(ctx, data.title, width - pad * 2 - 100), pad, y);
  ctx.font = `500 34px ${family}`; ctx.fillStyle = 'rgb(255 255 255 / .82)';
  y += 56; ctx.fillText(fit(ctx, data.author, width - pad * 2), pad, y);
  if (logo) ctx.drawImage(logo, width - pad - 76, pad + (story ? 52 : 0), 76, 62);

  // Mascot with the headline numbers next to it.
  const birdSize = story ? 340 : 260;
  y += story ? 70 : 40;
  // A white disc keeps the blue bird readable on the blue card.
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(pad + birdSize / 2 - 20, y + birdSize / 2, birdSize * .46, 0, Math.PI * 2); ctx.fill();
  if (bird) ctx.drawImage(bird, pad - 20 + birdSize * .08, y + birdSize * .08, birdSize * .84, birdSize * .84);
  const textX = pad + birdSize + 24;
  ctx.fillStyle = '#fff'; ctx.font = `800 ${story ? 150 : 128}px ${family}`;
  ctx.fillText(String(data.cans), textX, y + birdSize * .5);
  ctx.font = `700 40px ${family}`;
  ctx.fillText(`${plural(data.cans, 'банка', 'банки', 'банок')} за ${data.days} ${plural(data.days, 'день', 'дня', 'дней')}`, textX, y + birdSize * .5 + 56);
  ctx.font = `500 32px ${family}`; ctx.fillStyle = 'rgb(255 255 255 / .82)';
  ctx.fillText(`рекордная серия — ${data.best} ${plural(data.best, 'день', 'дня', 'дней')}`, textX, y + birdSize * .5 + 104);
  y += birdSize + (story ? 40 : 16);

  // White card: stat tiles, then the month grid.
  const cardH = height - y - pad - 56;
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(pad, y, width - pad * 2, cardH, 40); ctx.fill();
  const inner = pad + 40, innerW = width - pad * 2 - 80;
  const tiles: [string, string][] = [['Вкусов', String(data.unique)], ['Дней', `${data.days} из ${data.monthDays}`]];
  if (data.spent !== null) tiles.push(['Потрачено', rubles(data.spent)]);
  const tileGap = 20, tileW = (innerW - tileGap * (tiles.length - 1)) / tiles.length, tileY = y + 40;
  for (const [index, [label, value]] of tiles.entries()) {
    const x = inner + index * (tileW + tileGap);
    ctx.fillStyle = index === 2 ? BLUE : '#f3f6fb'; ctx.beginPath(); ctx.roundRect(x, tileY, tileW, 132, 24); ctx.fill();
    ctx.fillStyle = index === 2 ? 'rgb(255 255 255 / .85)' : '#59616b'; ctx.font = `600 26px ${family}`;
    ctx.fillText(fit(ctx, label, tileW - 48), x + 24, tileY + 48);
    ctx.fillStyle = index === 2 ? '#fff' : '#0b1b33'; ctx.font = `800 44px ${family}`;
    ctx.fillText(fit(ctx, value, tileW - 48), x + 24, tileY + 104);
  }
  let gridY = tileY + 132 + 36;
  if (data.top) {
    ctx.fillStyle = '#59616b'; ctx.font = `600 26px ${family}`; ctx.fillText('Чаще всего', inner, gridY + 6);
    ctx.fillStyle = '#0b1b33'; ctx.font = `800 36px ${family}`;
    ctx.fillText(fit(ctx, `${data.top.name} × ${data.top.count}`, innerW), inner, gridY + 52);
    gridY += 88;
  }
  // Month grid sized to the space left; streak days get an orange ring.
  ctx.fillStyle = '#59616b'; ctx.font = `600 24px ${family}`; ctx.textAlign = 'center';
  const rows = data.weeks.length, gap = 12;
  const cell = Math.min((innerW - gap * 6) / 7, (y + cardH - 40 - gridY - 44 - gap * (rows - 1)) / rows);
  const gridX = inner + (innerW - (cell * 7 + gap * 6)) / 2;
  WEEKDAYS.forEach((name, column) => ctx.fillText(name, gridX + column * (cell + gap) + cell / 2, gridY + 24));
  const streak = new Set(data.streakDays);
  for (const [row, week] of data.weeks.entries()) for (const [column, day] of week.entries()) {
    if (!day) continue;
    const x = gridX + column * (cell + gap), top = gridY + 44 + row * (cell + gap), count = data.counts[day] ?? 0;
    ctx.fillStyle = HEAT[Math.min(count, 4)]!; ctx.beginPath(); ctx.roundRect(x, top, cell, cell, cell * .22); ctx.fill();
    if (streak.has(day)) { ctx.strokeStyle = '#ff7a00'; ctx.lineWidth = 5; ctx.beginPath(); ctx.roundRect(x + 2.5, top + 2.5, cell - 5, cell - 5, cell * .2); ctx.stroke(); }
    ctx.fillStyle = count >= 3 ? '#fff' : '#0b1b33'; ctx.font = `700 ${Math.round(cell * .32)}px ${family}`; ctx.textBaseline = 'middle';
    ctx.fillText(String(Number(day.slice(8))), x + cell / 2, top + cell / 2 + 2); ctx.textBaseline = 'alphabetic';
  }
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgb(255 255 255 / .9)'; ctx.font = `700 30px ${family}`;
  ctx.fillText('canrush.ru · календарь выпитого', pad, height - pad + 8);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Не удалось создать PNG.')), 'image/png'));
}

export const renderDrinkSummary = (data: DrinkSummaryShot) => draw(data, 1080, 1350);
export const renderDrinkStory = (data: DrinkSummaryShot) => draw(data, 1080, 1920);
