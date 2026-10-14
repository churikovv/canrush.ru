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

/** Vertical (9:16) export: rows fill the given area, cells as large as possible so every drink fits. */
export function tierStoryLayout(counts: number[], area: { width: number; height: number }) {
  const labelWidth = 128, inset = 14, gap = 10, minCell = 28, maxCell = 168;
  const fit = (cell: number) => {
    const columns = Math.max(1, Math.floor((area.width - labelWidth - inset * 2 + gap) / (cell + gap)));
    const heights = counts.map(count => inset * 2 + Math.max(1, Math.ceil(count / columns)) * (cell + gap) - gap);
    return { cell, columns, heights, total: heights.reduce((sum, height) => sum + height, 0) };
  };
  let best = fit(minCell);
  for (let cell = maxCell; cell >= minCell; cell -= 2) {
    const candidate = fit(cell);
    if (candidate.total <= area.height) { best = candidate; break; }
  }
  // Spare height goes to the rows (capped), so short lists still read as a full-height board.
  const grow = counts.length ? Math.min(best.cell * 0.75, Math.max(0, area.height - best.total) / counts.length) : 0;
  let y = 0;
  const rows = best.heights.map(base => {
    const row = { y, height: base + grow, contentOffset: grow / 2 };
    y += row.height;
    return row;
  });
  return { labelWidth, inset, gap, cell: best.cell, columns: best.columns, width: area.width, height: y, rows };
}
