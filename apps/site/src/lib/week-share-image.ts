import type { WeeklyDigest } from '@/lib/story-digest';

/** «Твоя неделя» as one 1080×1920 picture for sharing to other apps' stories, in the colours of the viewer slides. */
const INK = '#13141a';
const LIME = '#c6f24e';
const PINK = '#ff4ecd';
const BLUE = '#2a35f0';
const ORANGE = '#ff5a1f';
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const image = new Image();
    const timer = setTimeout(() => resolve(null), 10_000);
    image.onload = () => { clearTimeout(timer); resolve(image); };
    image.onerror = () => { clearTimeout(timer); resolve(null); };
    image.src = src;
  });
}
const plural = (count: number, one: string, few: string, many: string) => {
  const a = count % 10, b = count % 100;
  return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many;
};
function dates(digest: WeeklyDigest) {
  const [from, to] = [digest.from, digest.to].map(day => { const [, month, date] = day.split('-').map(Number) as [number, number, number]; return { date, month: MONTHS[month - 1] ?? '' }; }) as [{ date: number; month: string }, { date: number; month: string }];
  return from.month === to.month ? `${from.date}–${to.date} ${to.month}` : `${from.date} ${from.month} — ${to.date} ${to.month}`;
}
function fit(ctx: CanvasRenderingContext2D, text: string, width: number): string {
  let value = text;
  while (ctx.measureText(value).width > width && value.length > 1) value = `${value.slice(0, -2)}…`;
  return value;
}

export async function renderWeekShare(digest: WeeklyDigest): Promise<Blob> {
  await document.fonts.ready;
  const family = getComputedStyle(document.body).fontFamily;
  const [cover, logo] = await Promise.all([
    digest.favorite?.cover ? loadImage(digest.favorite.cover) : null,
    loadImage('/brand/logo-mark-white.svg'),
  ]);
  const width = 1080, height = 1920, pad = 84;
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Не удалось создать изображение.');

  // Background and the slides' shapes: a lime disc, a pink rounded square, a blue ring.
  ctx.fillStyle = '#1e0b4f'; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = LIME; ctx.beginPath(); ctx.arc(width + 60, 120, 420, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.translate(-80, height - 260); ctx.rotate(.32); ctx.fillStyle = PINK; ctx.beginPath(); ctx.roundRect(0, 0, 520, 520, 140); ctx.fill(); ctx.restore();
  ctx.strokeStyle = BLUE; ctx.lineWidth = 46; ctx.beginPath(); ctx.arc(width - 40, height * .52, 170, 0, Math.PI * 2); ctx.stroke();

  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  if (logo) ctx.drawImage(logo, pad, pad + 4, 88, 72);
  ctx.fillStyle = '#fff'; ctx.font = `800 34px ${family}`;
  ctx.fillText(`ТВОЯ НЕДЕЛЯ · ${dates(digest).toUpperCase()}`, pad, 268);
  ctx.font = `900 128px ${family}`;
  ctx.fillText('Неделя', pad, 404); ctx.fillText('в CanRush', pad, 528);

  // Headline number on a white card.
  let y = 600;
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(pad, y, width - pad * 2, 330, 48); ctx.fill();
  ctx.fillStyle = INK; ctx.font = `900 220px ${family}`;
  const cans = String(digest.cans);
  ctx.fillText(cans, pad + 48, y + 236);
  const after = pad + 48 + ctx.measureText(cans).width + 28;
  ctx.font = `800 52px ${family}`; ctx.fillText(plural(digest.cans, 'банка', 'банки', 'банок'), after, y + 162);
  ctx.font = `600 36px ${family}`; ctx.fillStyle = '#4b5060';
  ctx.fillText(`за ${digest.days} ${plural(digest.days, 'день', 'дня', 'дней')} из 7`, after, y + 222);
  if (digest.ahead !== null) {
    ctx.font = `700 32px ${family}`; ctx.fillStyle = BLUE;
    ctx.fillText(fit(ctx, `больше, чем у ${digest.ahead}% участников`, width - pad * 2 - 96), pad + 48, y + 296);
  }
  y += 370;

  // Stat tiles in the slide colours.
  const tiles: [string, string, string, string][] = [
    ['Опыт', `+${digest.xp.toLocaleString('ru-RU')} XP`, LIME, INK],
    ['Серия', `${digest.streak} ${plural(digest.streak, 'день', 'дня', 'дней')}`, ORANGE, '#fff'],
    ['Новые вкусы', String(digest.newDrinks), PINK, INK],
    ['Рейтинг', digest.rank ? `№ ${digest.rank}` : '—', BLUE, '#fff'],
  ];
  const gap = 24, tileW = (width - pad * 2 - gap) / 2, tileH = 190;
  tiles.forEach(([label, value, background, color], index) => {
    const x = pad + (index % 2) * (tileW + gap), top = y + Math.floor(index / 2) * (tileH + gap);
    ctx.fillStyle = background; ctx.beginPath(); ctx.roundRect(x, top, tileW, tileH, 36); ctx.fill();
    ctx.fillStyle = color; ctx.globalAlpha = .8; ctx.font = `700 30px ${family}`; ctx.fillText(label, x + 36, top + 62); ctx.globalAlpha = 1;
    ctx.font = `900 70px ${family}`; ctx.fillText(fit(ctx, value, tileW - 72), x + 36, top + 150);
  });
  y += tileH * 2 + gap + 40;

  // Drink of the week: the can on a white tile and its name.
  if (digest.favorite) {
    const size = 260;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(pad, y, size, size, 40); ctx.fill();
    if (cover) {
      const scale = Math.min((size * .84) / cover.width, (size * .84) / cover.height);
      const w = cover.width * scale, h = cover.height * scale;
      ctx.globalCompositeOperation = 'multiply';
      ctx.drawImage(cover, pad + (size - w) / 2, y + (size - h) / 2, w, h);
      ctx.globalCompositeOperation = 'source-over';
    }
    const textX = pad + size + 40, textW = width - textX - pad;
    ctx.fillStyle = '#fff'; ctx.globalAlpha = .8; ctx.font = `700 30px ${family}`; ctx.fillText('ВКУС НЕДЕЛИ', textX, y + 70); ctx.globalAlpha = 1;
    ctx.font = `900 56px ${family}`;
    const words = digest.favorite.name.split(' ');
    const lines: string[] = [];
    for (const word of words) {
      const last = lines.at(-1);
      if (last && ctx.measureText(`${last} ${word}`).width <= textW) lines[lines.length - 1] = `${last} ${word}`;
      else lines.push(word);
    }
    lines.slice(0, 2).forEach((line, index) => ctx.fillText(fit(ctx, line, textW), textX, y + 140 + index * 64));
    ctx.font = `700 34px ${family}`; ctx.fillText(`× ${digest.favorite.count}`, textX, y + 140 + Math.min(lines.length, 2) * 64 + 10);
  }

  ctx.fillStyle = '#fff'; ctx.font = `800 36px ${family}`; ctx.textAlign = 'right';
  ctx.fillText('canrush.ru', width - pad, height - pad);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Не удалось создать PNG.')), 'image/png'));
}
