/** Export geometry is independent of the viewport and excludes editor controls. */
export function tierExportLayout(counts: number[]) {
  const total = counts.reduce((sum, count) => sum + count, 0);
  const columns = Math.min(24, Math.max(12, Math.ceil(Math.sqrt(total * 1.8))));
  const cell = 64, gap = 6, inset = 12, labelWidth = 72;
  const width = labelWidth + inset * 2 + columns * (cell + gap) - gap;
  let y = 64;
  const rows = counts.map(count => {
    const lines = Math.max(1, Math.ceil(count / columns));
    const height = inset * 2 + lines * (cell + gap) - gap;
    const row = { y, height };
    y += height;
    return row;
  });
  return { columns, cell, gap, inset, labelWidth, width, height: y + 20, rows };
}
