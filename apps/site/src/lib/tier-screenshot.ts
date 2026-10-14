import { tierExportLayout, tierStoryLayout } from './tier-export-layout';

type Box = { x: number; y: number; width: number; height: number };

function loadImage(src: string, message: string, crossOrigin = false): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (crossOrigin) image.crossOrigin = 'anonymous';
    const timeout = setTimeout(() => { image.onload = null; image.onerror = null; reject(new Error(message)); }, 15000);
    image.onload = () => { clearTimeout(timeout); resolve(image); };
    image.onerror = () => { clearTimeout(timeout); reject(new Error(message)); };
    image.src = src;
  });
}

/** Tier label cell: row background plus the gradient, outlined letter from the page CSS. */
function drawTierLabel(ctx: CanvasRenderingContext2D, label: HTMLElement, letter: Element, box: Box, size: number) {
  const style = getComputedStyle(letter);
  ctx.fillStyle = getComputedStyle(label).backgroundColor;
  ctx.fillRect(box.x, box.y, box.width, box.height);
  const gradient = ctx.createLinearGradient(0, box.y + box.height / 2 - size / 2, 0, box.y + box.height / 2 + size / 2);
  gradient.addColorStop(0, style.getPropertyValue('--tier-letter-top').trim());
  gradient.addColorStop(0.48, style.getPropertyValue('--tier-letter-middle').trim());
  gradient.addColorStop(1, style.getPropertyValue('--tier-letter-bottom').trim());
  ctx.font = `${style.fontWeight} ${size}px ${style.fontFamily}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.strokeStyle = style.getPropertyValue('--tier-letter-outline').trim() || '#242016'; ctx.lineWidth = Math.max(2, size / 16);
  ctx.strokeText(letter.textContent ?? '', box.x + box.width / 2, box.y + box.height / 2);
  ctx.fillStyle = gradient; ctx.fillText(letter.textContent ?? '', box.x + box.width / 2, box.y + box.height / 2);
}

/** Product photo contained in a light tile, or the editor's text fallback. */
async function drawProduct(ctx: CanvasRenderingContext2D, item: HTMLElement, box: Box, radius: number, family: string, muted: string) {
  const img = item.querySelector('img');
  if (!img) {
    const fallback = item.querySelector('.tier-editor-product-image > span, span[aria-hidden="true"]')?.textContent ?? '?';
    ctx.font = `700 ${Math.round(box.height / 4)}px ${family}`; ctx.fillStyle = muted; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(fallback, box.x + box.width / 2, box.y + box.height / 2);
    return;
  }
  const image = await loadImage(img.currentSrc || img.src, 'Не удалось загрузить фотографию напитка. Попробуйте ещё раз.', true);
  const factor = Math.min(box.width / image.naturalWidth, box.height / image.naturalHeight);
  const w = image.naturalWidth * factor, h = image.naturalHeight * factor;
  ctx.save(); ctx.beginPath(); ctx.roundRect(box.x, box.y, box.width, box.height, radius); ctx.clip();
  ctx.fillStyle = '#f3f4f6'; ctx.fillRect(box.x, box.y, box.width, box.height);
  ctx.drawImage(image, box.x + (box.width - w) / 2, box.y + (box.height - h) / 2, w, h); ctx.restore();
}

function authorCaptionFor(telegramChannel?: string | null, authorUsername?: string, official = false) {
  const channel = telegramChannel?.trim(), username = authorUsername?.trim();
  return official ? 'canrush.ru' : channel ? `t.me/${channel}` : username ? `@${username} · Canrush` : '';
}

function toPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Не удалось создать PNG.')), 'image/png'));
}

/** Render only the current board, excluding editor controls and selection outlines. */
export async function renderTierScreenshot(board: HTMLElement, title: string, telegramChannel?: string | null, authorUsername?: string, official = false): Promise<Blob> {
  await document.fonts.ready;
  const boardRows = [...board.querySelectorAll<HTMLElement>('.tier-board-row, .tier-editor-row')];
  const layout = tierExportLayout(boardRows.map(row => row.querySelectorAll('.tier-board-product, .tier-editor-product').length));
  const authorCaption = authorCaptionFor(telegramChannel, authorUsername, official);
  const padding = 20, headerExtra = authorCaption ? 48 : 24;
  const width = layout.width + padding * 2, height = layout.height + headerExtra;
  const scale = Math.min(2, 16384 / Math.max(width, height), Math.sqrt(16_000_000 / (width * height)));
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width * scale); canvas.height = Math.ceil(height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Не удалось создать изображение.');
  ctx.scale(scale, scale);
  ctx.fillStyle = getComputedStyle(board).getPropertyValue('--color-brand').trim() || '#006eff';
  ctx.beginPath(); ctx.roundRect(0, 0, width, height, 20); ctx.fill();
  const boardStyle = getComputedStyle(board);
  const surface = boardStyle.getPropertyValue('--color-surface').trim() || '#ffffff';
  const border = boardStyle.getPropertyValue('--color-control').trim() || '#dfe3e8';
  const muted = boardStyle.getPropertyValue('--color-muted-strong').trim() || '#59616b';
  const family = boardStyle.fontFamily;
  ctx.fillStyle = '#ffffff'; ctx.font = `700 24px ${family}`;
  let caption = title.trim() || 'Мой тирлист';
  while (ctx.measureText(caption).width > width - padding * 2 - 72 && caption.length > 1) caption = caption.slice(0, -2) + '…';
  ctx.textBaseline = 'middle';
  ctx.fillText(caption, padding, 44);
  if (authorCaption) {
    ctx.font = `400 16px ${family}`;
    ctx.fillText(authorCaption, padding, 72);
  }
  const logo = await loadImage('/brand/logo-mark.svg', 'Не удалось загрузить логотип. Попробуйте ещё раз.');
  ctx.drawImage(logo, width - padding - 44, 26, 44, 36);
  const boardTop = 64 + headerExtra, boardHeight = layout.height - 20 - 64;
  ctx.save();
  ctx.beginPath(); ctx.roundRect(padding, boardTop, layout.width, boardHeight, 24); ctx.clip();
  ctx.fillStyle = surface; ctx.fillRect(padding, boardTop, layout.width, boardHeight);
  const imageJobs: Promise<void>[] = [];
  for (const [rowIndex, row] of boardRows.entries()) {
    const label = row.querySelector('h2');
    const letter = label?.querySelector('.tier-letter');
    if (!label || !letter) continue;
    const geometry = layout.rows[rowIndex]!;
    const box = { x: padding, y: geometry.y + headerExtra, width: layout.labelWidth, height: geometry.height };
    const rowBox = { ...box, width: layout.width };
    drawTierLabel(ctx, label, letter, box, 32);
    ctx.strokeStyle = border; ctx.lineWidth = 1;
    ctx.strokeRect(rowBox.x, rowBox.y, rowBox.width, rowBox.height);
    ctx.strokeRect(box.x, box.y, box.width, box.height);
    for (const [index, item] of [...row.querySelectorAll<HTMLElement>('.tier-board-product, .tier-editor-product')].entries()) {
      const itemBox = { x: padding + layout.labelWidth + layout.inset + (index % layout.columns) * (layout.cell + layout.gap), y: geometry.y + headerExtra + layout.inset + Math.floor(index / layout.columns) * (layout.cell + layout.gap), width: layout.cell, height: layout.cell };
      imageJobs.push(drawProduct(ctx, item, itemBox, 6, family, muted));
    }
  }
  await Promise.all(imageJobs);
  ctx.restore();
  ctx.beginPath(); ctx.roundRect(padding + 0.5, boardTop + 0.5, layout.width - 1, boardHeight - 1, 24);
  ctx.strokeStyle = border; ctx.lineWidth = 1; ctx.stroke();
  return toPng(canvas);
}

export const STORY_SIZE = { width: 1080, height: 1920 } as const;

/** 9:16 TikTok/Reels/Stories image drawn natively for the vertical frame: brand header, big title,
 *  then a full-height board whose cells grow to fill it. Stays clear of the app overlays (bottom and right). */
export async function renderTierStory(board: HTMLElement, title: string, telegramChannel?: string | null, authorUsername?: string, official = false): Promise<Blob> {
  await document.fonts.ready;
  const { width, height } = STORY_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Не удалось создать изображение.');
  const boardStyle = getComputedStyle(board);
  const surface = boardStyle.getPropertyValue('--color-surface').trim() || '#ffffff';
  const border = boardStyle.getPropertyValue('--color-control').trim() || '#dfe3e8';
  const muted = boardStyle.getPropertyValue('--color-muted-strong').trim() || '#59616b';
  const family = boardStyle.fontFamily;
  const background = ctx.createRadialGradient(width * .3, height * .2, 0, width * .3, height * .2, height);
  background.addColorStop(0, '#3b93ff'); background.addColorStop(.38, '#006eff'); background.addColorStop(.75, '#0049b8'); background.addColorStop(1, '#002f7a');
  ctx.fillStyle = background; ctx.fillRect(0, 0, width, height);
  // Header: logo + site, then the title (up to two lines) and the author caption.
  const left = 60, safeRight = 120, contentWidth = width - left - safeRight;
  const logo = await loadImage('/brand/logo-mark-white.svg', 'Не удалось загрузить логотип. Попробуйте ещё раз.');
  ctx.drawImage(logo, left, 120, 58, 48);
  ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.globalAlpha = .85; ctx.font = `700 30px ${family}`; ctx.fillText('canrush.ru', left + 76, 145); ctx.globalAlpha = 1;
  ctx.font = `800 64px ${family}`;
  const words = (title.trim() || 'Мой тирлист').split(/\s+/);
  const lines: string[] = [];
  for (const word of words) {
    const last = lines.at(-1);
    if (last !== undefined && ctx.measureText(`${last} ${word}`).width <= contentWidth) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  if (lines.length > 2) { lines.length = 2; }
  lines.forEach((line, index) => {
    let text = line;
    const overflow = index === 1 && words.join(' ').length > lines.join(' ').length;
    while ((ctx.measureText(text + (overflow ? '…' : '')).width > contentWidth) && text.length > 1) text = text.slice(0, -1);
    ctx.fillText(text + (overflow ? '…' : ''), left, 250 + index * 74);
  });
  let boardTop = 250 + lines.length * 74 - 10;
  const caption = authorCaptionFor(telegramChannel, authorUsername, official);
  if (caption) { ctx.globalAlpha = .8; ctx.font = `400 32px ${family}`; ctx.fillText(caption, left, boardTop + 14); ctx.globalAlpha = 1; boardTop += 50; }
  boardTop += 24;
  const boardBottom = height - 380;
  const rows = [...board.querySelectorAll<HTMLElement>('.tier-board-row, .tier-editor-row')];
  const layout = tierStoryLayout(rows.map(row => row.querySelectorAll('.tier-board-product, .tier-editor-product').length), { width: contentWidth, height: boardBottom - boardTop });
  const top = boardTop + Math.max(0, (boardBottom - boardTop - layout.height) / 2);
  ctx.save(); ctx.shadowColor = 'rgb(0 20 80 / .45)'; ctx.shadowBlur = 48; ctx.shadowOffsetY = 18;
  ctx.beginPath(); ctx.roundRect(left, top, layout.width, layout.height, 32); ctx.fillStyle = surface; ctx.fill(); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.roundRect(left, top, layout.width, layout.height, 32); ctx.clip();
  const jobs: Promise<void>[] = [];
  for (const [rowIndex, row] of rows.entries()) {
    const label = row.querySelector('h2'), letter = label?.querySelector('.tier-letter');
    const geometry = layout.rows[rowIndex];
    if (!label || !letter || !geometry) continue;
    const box = { x: left, y: top + geometry.y, width: layout.labelWidth, height: geometry.height };
    drawTierLabel(ctx, label, letter, box, Math.min(64, geometry.height * .5));
    ctx.strokeStyle = border; ctx.lineWidth = 1.5;
    if (rowIndex > 0) { ctx.beginPath(); ctx.moveTo(left, box.y); ctx.lineTo(left + layout.width, box.y); ctx.stroke(); }
    for (const [index, item] of [...row.querySelectorAll<HTMLElement>('.tier-board-product, .tier-editor-product')].entries()) {
      const itemBox = { x: left + layout.labelWidth + layout.inset + (index % layout.columns) * (layout.cell + layout.gap), y: box.y + geometry.contentOffset + layout.inset + Math.floor(index / layout.columns) * (layout.cell + layout.gap), width: layout.cell, height: layout.cell };
      jobs.push(drawProduct(ctx, item, itemBox, Math.max(6, layout.cell / 10), family, muted));
    }
  }
  await Promise.all(jobs);
  ctx.restore();
  ctx.beginPath(); ctx.roundRect(left + .75, top + .75, layout.width - 1.5, layout.height - 1.5, 32); ctx.strokeStyle = border; ctx.lineWidth = 1.5; ctx.stroke();
  return toPng(canvas);
}
