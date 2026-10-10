import { tierExportLayout } from './tier-export-layout';

/** Render only the current board, excluding editor controls and selection outlines. */
export async function renderTierScreenshot(board: HTMLElement, title: string, telegramChannel?: string | null, authorUsername?: string, official = false): Promise<Blob> {
  await document.fonts.ready;
  const boardRows = [...board.querySelectorAll<HTMLElement>('.tier-board-row, .tier-editor-row')];
  const layout = tierExportLayout(boardRows.map(row => row.querySelectorAll('.tier-board-product, .tier-editor-product').length));
  const channel = telegramChannel?.trim();
  const username = authorUsername?.trim();
  const authorCaption = official ? 'canrush.ru' : channel ? `t.me/${channel}` : username ? `@${username} · Canrush` : '';
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
  const logo = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const timeout = setTimeout(() => { image.onload = null; image.onerror = null; reject(new Error('Не удалось загрузить логотип. Попробуйте ещё раз.')); }, 15000);
    image.onload = () => { clearTimeout(timeout); resolve(image); };
    image.onerror = () => { clearTimeout(timeout); reject(new Error('Не удалось загрузить логотип. Попробуйте ещё раз.')); };
    image.src = '/brand/logo-mark.svg';
  });
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
    const style = getComputedStyle(letter);
    ctx.fillStyle = getComputedStyle(label).backgroundColor;
    ctx.fillRect(box.x, box.y, box.width, box.height);
    ctx.strokeStyle = border; ctx.lineWidth = 1;
    ctx.strokeRect(rowBox.x, rowBox.y, rowBox.width, rowBox.height);
    ctx.strokeRect(box.x, box.y, box.width, box.height);
    const size = 32;
    const gradient = ctx.createLinearGradient(0, box.y + box.height / 2 - size / 2, 0, box.y + box.height / 2 + size / 2);
    gradient.addColorStop(0, style.getPropertyValue('--tier-letter-top').trim());
    gradient.addColorStop(0.48, style.getPropertyValue('--tier-letter-middle').trim());
    gradient.addColorStop(1, style.getPropertyValue('--tier-letter-bottom').trim());
    ctx.font = `${style.fontWeight} ${size}px ${style.fontFamily}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.strokeStyle = style.getPropertyValue('--tier-letter-outline').trim() || '#242016'; ctx.lineWidth = 2;
    ctx.strokeText(letter.textContent ?? '', box.x + box.width / 2, box.y + box.height / 2);
    ctx.fillStyle = gradient; ctx.fillText(letter.textContent ?? '', box.x + box.width / 2, box.y + box.height / 2);
    for (const [index, item] of [...row.querySelectorAll<HTMLElement>('.tier-board-product, .tier-editor-product')].entries()) {
      const itemBox = { x: padding + layout.labelWidth + layout.inset + (index % layout.columns) * (layout.cell + layout.gap), y: geometry.y + headerExtra + layout.inset + Math.floor(index / layout.columns) * (layout.cell + layout.gap), width: layout.cell, height: layout.cell };
      const img = item.querySelector('img');
      if (img) {
        const imageBox = itemBox, src = img.currentSrc || img.src;
        imageJobs.push(new Promise<void>((resolve, reject) => {
          const image = new Image(); image.crossOrigin = 'anonymous';
          const timeout = setTimeout(() => { image.onload = null; image.onerror = null; reject(new Error('Фотографии загружаются слишком долго. Попробуйте ещё раз.')); }, 15000);
          image.onload = () => {
            clearTimeout(timeout);
            const factor = Math.min(imageBox.width / image.naturalWidth, imageBox.height / image.naturalHeight);
            const w = image.naturalWidth * factor, h = image.naturalHeight * factor;
            ctx.save(); ctx.beginPath(); ctx.roundRect(imageBox.x, imageBox.y, imageBox.width, imageBox.height, 6); ctx.clip();
            ctx.fillStyle = '#f3f4f6'; ctx.fillRect(imageBox.x, imageBox.y, imageBox.width, imageBox.height);
            ctx.drawImage(image, imageBox.x + (imageBox.width - w) / 2, imageBox.y + (imageBox.height - h) / 2, w, h); ctx.restore(); resolve();
          };
          image.onerror = () => { clearTimeout(timeout); reject(new Error('Не удалось загрузить фотографию напитка. Попробуйте ещё раз.')); };
          image.src = src;
        }));
      } else {
        const fallback = item.querySelector('.tier-editor-product-image > span, span[aria-hidden="true"]')?.textContent ?? '?';
        ctx.font = `700 16px ${family}`; ctx.fillStyle = muted;
        ctx.fillText(fallback, itemBox.x + itemBox.width / 2, itemBox.y + itemBox.height / 2);
      }
    }
  }
  await Promise.all(imageJobs);
  ctx.restore();
  ctx.beginPath(); ctx.roundRect(padding + 0.5, boardTop + 0.5, layout.width - 1, boardHeight - 1, 24);
  ctx.strokeStyle = border; ctx.lineWidth = 1; ctx.stroke();
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Не удалось создать PNG.')), 'image/png'));
}
