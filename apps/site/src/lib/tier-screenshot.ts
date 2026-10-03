/** Render only the current board, excluding editor controls and selection outlines. */
export async function renderTierScreenshot(board: HTMLElement, title: string): Promise<Blob> {
  await document.fonts.ready;
  const bounds = board.getBoundingClientRect();
  const padding = 20, heading = 64;
  const width = Math.ceil(bounds.width + padding * 2), height = Math.ceil(bounds.height + heading + padding);
  const scale = Math.min(2, 16384 / Math.max(width, height), Math.sqrt(16_000_000 / (width * height)));
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width * scale); canvas.height = Math.ceil(height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Не удалось создать изображение.');
  ctx.scale(scale, scale);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height);
  const family = getComputedStyle(board).fontFamily;
  ctx.fillStyle = '#202429'; ctx.font = `700 20px ${family}`;
  let caption = title.trim() || 'Мой тирлист';
  while (ctx.measureText(caption).width > width - padding * 2 && caption.length > 1) caption = caption.slice(0, -2) + '…';
  ctx.fillText(caption, padding, 37);
  const offset = (element: Element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.x - bounds.x + padding, y: rect.y - bounds.y + heading, width: rect.width, height: rect.height };
  };
  const imageJobs: Promise<void>[] = [];
  for (const row of board.querySelectorAll<HTMLElement>('.tier-board-row, .tier-editor-row')) {
    const label = row.querySelector('h2');
    const letter = label?.querySelector('.tier-letter');
    if (!label || !letter) continue;
    const box = offset(label), rowBox = offset(row), style = getComputedStyle(letter);
    ctx.fillStyle = getComputedStyle(label).backgroundColor;
    ctx.fillRect(box.x, box.y, box.width, box.height);
    ctx.strokeStyle = '#dfe3e8'; ctx.lineWidth = 1;
    ctx.strokeRect(rowBox.x, rowBox.y, rowBox.width, rowBox.height);
    const size = Number.parseFloat(style.fontSize);
    const gradient = ctx.createLinearGradient(0, box.y + box.height / 2 - size / 2, 0, box.y + box.height / 2 + size / 2);
    gradient.addColorStop(0, style.getPropertyValue('--tier-letter-top').trim());
    gradient.addColorStop(1, style.getPropertyValue('--tier-letter-bottom').trim());
    ctx.font = `${style.fontWeight} ${size}px ${style.fontFamily}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.strokeStyle = style.getPropertyValue('--tier-letter-outline').trim() || '#242016'; ctx.lineWidth = 2;
    ctx.strokeText(letter.textContent ?? '', box.x + box.width / 2, box.y + box.height / 2);
    ctx.fillStyle = gradient; ctx.fillText(letter.textContent ?? '', box.x + box.width / 2, box.y + box.height / 2);
    for (const item of row.querySelectorAll<HTMLElement>('.tier-board-product, .tier-editor-product')) {
      const img = item.querySelector('img');
      if (img) {
        const imageBox = offset(img), src = img.currentSrc || img.src;
        imageJobs.push(new Promise<void>((resolve, reject) => {
          const image = new Image(); image.crossOrigin = 'anonymous';
          const timeout = setTimeout(() => { image.onload = null; image.onerror = null; reject(new Error('Фотографии загружаются слишком долго. Попробуйте ещё раз.')); }, 15000);
          image.onload = () => {
            clearTimeout(timeout);
            const factor = Math.min(imageBox.width / image.naturalWidth, imageBox.height / image.naturalHeight);
            const w = image.naturalWidth * factor, h = image.naturalHeight * factor;
            ctx.drawImage(image, imageBox.x + (imageBox.width - w) / 2, imageBox.y + (imageBox.height - h) / 2, w, h); resolve();
          };
          image.onerror = () => { clearTimeout(timeout); reject(new Error('Не удалось загрузить фотографию напитка. Попробуйте ещё раз.')); };
          image.src = src;
        }));
      } else {
        const itemBox = offset(item);
        const fallback = item.querySelector('.tier-editor-product-image > span, span[aria-hidden="true"]')?.textContent ?? '?';
        ctx.font = `700 16px ${family}`; ctx.fillStyle = '#59616b';
        ctx.fillText(fallback, itemBox.x + itemBox.width / 2, itemBox.y + itemBox.height / 2);
      }
    }
  }
  await Promise.all(imageJobs);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Не удалось создать PNG.')), 'image/png'));
}
