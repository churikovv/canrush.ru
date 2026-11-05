import { cutoutSrc } from '@/lib/can-cutout-src';
import type { TasteCardView } from '@/lib/taste-card';

/**
 * «Мой вкус» одной картинкой 1080×1920 — для историй в других приложениях, в стиле бенто, как карточка на экране:
 * тёмные плитки разного размера с синим свечением и тонкой рамкой. Ничего не обрезается многоточием: заголовок и
 * значения уменьшаются под ширину, описание переносится, вкусы встают в строки. Высоты плиток считаются из того, что
 * есть в карточке, поэтому картинка всегда заполнена.
 */
const WIDTH = 1080, HEIGHT = 1920, PAD = 56, GAP = 24, RADIUS = 44;
const INNER = WIDTH - PAD * 2;
const ACCENT = '#3d8bff';
const KICKER = '#8fb2ff';
const TILE = '#070b17';

type Can = { image: HTMLImageElement; cut: boolean };
type Glow = { x: number; y: number; r: number; color: string };

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const image = new Image();
    const timer = setTimeout(() => resolve(null), 10_000);
    image.onload = () => { clearTimeout(timer); resolve(image); };
    image.onerror = () => { clearTimeout(timer); resolve(null); };
    image.src = src;
  });
}
/** The can without its shop background when the site can cut it (`/api/can-cutouts`), the plain cover otherwise. */
async function loadCan(cover: string): Promise<Can | null> {
  const cut = cutoutSrc(cover);
  const image = cut ? await loadImage(cut) : null;
  if (image) return { image, cut: true };
  const plain = await loadImage(cover);
  return plain ? { image: plain, cut: false } : null;
}
const plural = (count: number, one: string, few: string, many: string) => {
  const tens = count % 100, ones = count % 10;
  return tens >= 11 && tens <= 14 ? many : ones === 1 ? one : ones >= 2 && ones <= 4 ? few : many;
};
/** Самый крупный кегль до `size`, при котором строка помещается в ширину. */
function fitFont(ctx: CanvasRenderingContext2D, text: string, width: number, size: number, weight: number, family: string): number {
  let current = size;
  ctx.font = `${weight} ${current}px ${family}`;
  while (ctx.measureText(text).width > width && current > 36) { current -= 4; ctx.font = `${weight} ${current}px ${family}`; }
  return current;
}
/** Строки по словам в ширину. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  for (const word of text.split(/\s+/)) {
    const last = lines.at(-1);
    if (last !== undefined && ctx.measureText(`${last} ${word}`).width <= width) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines;
}

/** A bento tile: the dark base, its glows clipped to the rounded shape, a hairline border. */
function tile(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, glows: Glow[]) {
  ctx.save();
  ctx.beginPath(); ctx.roundRect(x, y, w, h, RADIUS); ctx.fillStyle = TILE; ctx.fill(); ctx.clip();
  for (const glow of glows) {
    const gradient = ctx.createRadialGradient(glow.x, glow.y, 0, glow.x, glow.y, glow.r);
    gradient.addColorStop(0, glow.color); gradient.addColorStop(1, 'rgb(0 110 255 / 0)');
    ctx.fillStyle = gradient; ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
  ctx.beginPath(); ctx.roundRect(x + 1, y + 1, w - 2, h - 2, RADIUS); ctx.strokeStyle = 'rgb(110 150 255 / .24)'; ctx.lineWidth = 2; ctx.stroke();
}
function kicker(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, family: string) {
  ctx.fillStyle = KICKER; ctx.font = `800 30px ${family}`; ctx.fillText(text, x, y);
}

type Pill = { text: string; filled: boolean; muted?: boolean };

/** Rows of pills at a size: widths measured, wrapped to the box width. */
function pillRows(ctx: CanvasRenderingContext2D, labels: Pill[], width: number, size: number, family: string) {
  const padX = size * .9, gap = size * .35;
  ctx.font = `800 ${size}px ${family}`;
  const rows: (Pill & { w: number })[][] = [[]];
  let used = 0;
  for (const label of labels) {
    const w = Math.min(width, ctx.measureText(label.text).width + padX * 2);
    if (used && used + gap + w > width) { rows.push([]); used = 0; }
    rows.at(-1)!.push({ ...label, w });
    used += (used ? gap : 0) + w;
  }
  return { rows, height: size * 1.7, gap, padX };
}

/**
 * Pills laid out in rows, centred in the box, each turned a little like scattered tags; `filled` ones are white,
 * `muted` ones crossed out. The size steps down from `size` until every pill fits the box — none is ever dropped.
 */
function pills(ctx: CanvasRenderingContext2D, labels: Pill[], box: { x: number; y: number; w: number; h: number }, size: number, family: string) {
  const turns = [-5, 4, -2, 3];
  let layout = pillRows(ctx, labels, box.w - 12, size, family);
  for (let current = size; current >= size * .5; current -= 2) {
    layout = pillRows(ctx, labels, box.w - 12, current, family);
    if (layout.rows.length * layout.height + (layout.rows.length - 1) * layout.gap <= box.h) break;
  }
  const { rows, height, gap, padX } = layout;
  const textSize = height / 1.7;
  ctx.font = `800 ${textSize}px ${family}`;
  let top = box.y + (box.h - (rows.length * height + (rows.length - 1) * gap)) / 2, index = 0;
  for (const row of rows) {
    const rowW = row.reduce((sum, item) => sum + item.w, 0) + gap * (row.length - 1);
    let left = box.x + (box.w - rowW) / 2;
    for (const item of row) {
      ctx.save();
      ctx.translate(left + item.w / 2, top + height / 2);
      ctx.rotate(((turns[index % turns.length] ?? 0) * Math.PI) / 180);
      ctx.beginPath(); ctx.roundRect(-item.w / 2, -height / 2, item.w, height, height / 2);
      if (item.filled) { ctx.fillStyle = '#fff'; ctx.fill(); }
      else { ctx.strokeStyle = item.muted ? 'rgb(255 255 255 / .28)' : ACCENT; ctx.lineWidth = item.muted ? 3 : 5; ctx.stroke(); }
      ctx.fillStyle = item.filled ? '#06102a' : item.muted ? '#b8c6ea' : '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(item.text, 0, textSize * .36, item.w - padX);
      if (item.muted) {
        const lineW = Math.min(ctx.measureText(item.text).width, item.w - padX);
        ctx.strokeStyle = 'rgb(255 255 255 / .45)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-lineW / 2, 0); ctx.lineTo(lineW / 2, 0); ctx.stroke();
      }
      ctx.restore();
      left += item.w + gap; index++;
    }
    top += height + gap;
  }
  ctx.textAlign = 'left';
}

/** A stat tile: a kicker and a value as big as the width allows, an optional line under it. */
function stat(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, caption: string, value: string, family: string, glow: Glow[], note?: string) {
  tile(ctx, x, y, w, h, glow);
  kicker(ctx, caption.toUpperCase(), x + 36, y + 62, family);
  ctx.fillStyle = '#fff';
  fitFont(ctx, value, w - 72, note ? 132 : 84, 900, family);
  ctx.fillText(value, x + 36, y + h - (note ? 82 : 44));
  if (note) { ctx.fillStyle = '#a9bcef'; ctx.font = `600 30px ${family}`; ctx.fillText(note, x + 36, y + h - 36, w - 72); }
}

export async function renderTasteShare(card: TasteCardView): Promise<Blob> {
  await document.fonts.ready;
  const family = getComputedStyle(document.body).fontFamily;
  const [logo, ...loaded] = await Promise.all([loadImage('/brand/logo-mark-white.svg'), ...card.drinks.map(drink => loadCan(drink.cover))]);
  const cans = loaded.filter((can): can is Can => Boolean(can));
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH; canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Не удалось создать изображение. Попробуйте ещё раз.');
  ctx.fillStyle = '#03050c'; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';

  // Row heights: a base each, the rest of the height shared by the rows that can grow.
  const bottom = card.avoids.length > 0 || Boolean(card.sugarfree);
  const rows = [
    { key: 'hero', base: 500, grow: 1 },
    ...(card.loves.length ? [{ key: 'loves', base: 300, grow: .6 }] : []),
    { key: 'middle', base: cans.length ? 460 : 230, grow: cans.length ? 1 : .4 },
    ...(bottom ? [{ key: 'bottom', base: 210, grow: 0 }] : []),
    { key: 'footer', base: 56, grow: 0 },
  ];
  const free = HEIGHT - PAD * 2 - GAP * (rows.length - 1) - rows.reduce((sum, row) => sum + row.base, 0);
  const grow = rows.reduce((sum, row) => sum + row.grow, 0);
  const heights = new Map(rows.map(row => [row.key, row.base + (free * row.grow) / grow]));
  const half = (INNER - GAP) / 2;
  let y = PAD;

  // Hero: the mark and the kicker on top, the archetype and its lead over a blue glow rising from the bottom.
  const heroH = heights.get('hero')!;
  tile(ctx, PAD, y, INNER, heroH, [
    { x: PAD + INNER / 2, y: y + heroH * 1.25, r: heroH * 1.05, color: 'rgb(46 134 255 / .95)' },
    { x: PAD + INNER, y, r: INNER * .5, color: 'rgb(0 110 255 / .25)' },
  ]);
  if (logo) ctx.drawImage(logo, PAD + 44, y + 44, 84, 68);
  kicker(ctx, 'МОЙ ВКУС В CANRUSH', PAD + 152, y + 90, family);
  ctx.font = `600 44px ${family}`;
  const lead = wrap(ctx, card.lead, INNER - 88).slice(0, 2);
  const leadTop = y + heroH - 52 - (lead.length - 1) * 58;
  ctx.fillStyle = '#d5e1ff';
  lead.forEach((line, index) => ctx.fillText(line, PAD + 44, leadTop + index * 58));
  fitFont(ctx, card.title, INNER - 88, 200, 900, family);
  ctx.fillStyle = '#fff'; ctx.fillText(card.title, PAD + 44, leadTop - 76);
  y += heroH + GAP;

  // Loves: the flavours as tags, the first one filled.
  if (card.loves.length) {
    const h = heights.get('loves')!;
    tile(ctx, PAD, y, INNER, h, [{ x: PAD, y: y + h, r: INNER * .7, color: 'rgb(0 110 255 / .5)' }]);
    kicker(ctx, 'ЛЮБЛЮ', PAD + 36, y + 62, family);
    pills(ctx, card.loves.map((item, index) => ({ text: item.label, filled: index === 0 })), { x: PAD + 36, y: y + 90, w: INNER - 72, h: h - 120 }, 64, family);
    y += h + GAP;
  }

  // Middle: the favourite cans fanned out on a glow, the brand and the count beside them.
  const middleH = heights.get('middle')!;
  const brandCaption = card.brand ? 'Любимый бренд' : 'Нравится';
  const brandValue = card.brand ? card.brand.name : `${Math.round((100 * card.likes) / card.decisions)}%`;
  const countNote = `${plural(card.decisions, 'напиток', 'напитка', 'напитков')} · ${card.likes} нравится`;
  const softGlow = (x: number, top: number, w: number): Glow[] => [{ x: x + w, y: top, r: w * .9, color: 'rgb(0 110 255 / .28)' }];
  if (cans.length) {
    tile(ctx, PAD, y, half, middleH, [{ x: PAD + half / 2, y: y + middleH * .68, r: half * .62, color: 'rgb(0 110 255 / .75)' }]);
    kicker(ctx, 'ЛЮБИМЫЕ БАНКИ', PAD + 36, y + 62, family);
    const boxH = middleH - 130, boxW = half * .5, centre = PAD + half / 2, floor = y + middleH - 30;
    // The side cans first, the middle one over them.
    const place = [{ dx: 0, turn: 0, scale: 1 }, { dx: -boxW * .62, turn: -12, scale: .78 }, { dx: boxW * .62, turn: 12, scale: .78 }];
    for (const index of [1, 2, 0].filter(at => at < cans.length)) {
      const can = cans[index]!, at = place[index]!;
      const fit = Math.min((boxW * at.scale) / can.image.width, (boxH * at.scale) / can.image.height);
      const w = can.image.width * fit, h = can.image.height * fit;
      ctx.save();
      ctx.translate(centre + at.dx, floor - h / 2);
      ctx.rotate((at.turn * Math.PI) / 180);
      ctx.shadowColor = 'rgb(0 0 0 / .55)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 14;
      if (!can.cut) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(-w / 2 - 10, -h / 2 - 10, w + 20, h + 20, 24); ctx.fill(); ctx.shadowColor = 'transparent'; }
      ctx.drawImage(can.image, -w / 2, -h / 2, w, h);
      ctx.restore();
    }
    const statH = (middleH - GAP) / 2, x = PAD + half + GAP;
    stat(ctx, x, y, half, statH, brandCaption, brandValue, family, softGlow(x, y, half));
    stat(ctx, x, y + statH + GAP, half, statH, 'Оценено', String(card.decisions), family, softGlow(x, y + statH + GAP, half), countNote);
  } else {
    stat(ctx, PAD, y, half, middleH, brandCaption, brandValue, family, softGlow(PAD, y, half));
    stat(ctx, PAD + half + GAP, y, half, middleH, 'Оценено', String(card.decisions), family, softGlow(PAD + half + GAP, y, half), countNote);
  }
  y += middleH + GAP;

  // Bottom: what is not theirs (crossed out) and sugar; one of them alone takes the whole width.
  if (bottom) {
    const h = heights.get('bottom')!;
    const both = card.avoids.length > 0 && Boolean(card.sugarfree);
    const avoidsW = both ? half : INNER;
    if (card.avoids.length) {
      tile(ctx, PAD, y, avoidsW, h, softGlow(PAD, y, avoidsW));
      kicker(ctx, 'НЕ МОЁ', PAD + 36, y + 62, family);
      pills(ctx, card.avoids.map(item => ({ text: item.label, filled: false, muted: true })), { x: PAD + 36, y: y + 82, w: avoidsW - 72, h: h - 100 }, 38, family);
    }
    if (card.sugarfree) {
      const x = both ? PAD + half + GAP : PAD, w = both ? half : INNER;
      stat(ctx, x, y, w, h, 'Без сахара', card.sugarfree === 'loves' ? 'Да' : 'Не моё', family, softGlow(x, y, w));
    }
  }

  // Footer line under the tiles.
  ctx.fillStyle = '#fff'; ctx.font = `800 36px ${family}`;
  ctx.fillText('Найди свой вкус в дейтинге напитков', PAD + 8, HEIGHT - PAD - 8);
  ctx.textAlign = 'right'; ctx.globalAlpha = .7; ctx.font = `700 34px ${family}`;
  ctx.fillText('canrush.ru', WIDTH - PAD - 8, HEIGHT - PAD - 8);
  ctx.globalAlpha = 1; ctx.textAlign = 'left';
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Не удалось создать PNG. Попробуйте ещё раз.')), 'image/png'));
}
