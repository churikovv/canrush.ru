export type PageSlot = number | 'gap';

/**
 * Page numbers to show around the current one: always the first and the last page, one neighbour on each side,
 * and a gap where pages are skipped. A gap never hides a single page — that page is shown instead.
 */
export function pageWindow(current: number, total: number): PageSlot[] {
  if (total <= 1) return total === 1 ? [1] : [];
  const page = Math.min(Math.max(1, current), total);
  const shown = new Set([1, total, page - 1, page, page + 1].filter(value => value >= 1 && value <= total));
  const sorted = [...shown].sort((a, b) => a - b);
  const slots: PageSlot[] = [];
  for (const value of sorted) {
    const previous = slots.at(-1);
    if (typeof previous === 'number' && value - previous === 2) slots.push(previous + 1);
    else if (typeof previous === 'number' && value - previous > 2) slots.push('gap');
    slots.push(value);
  }
  return slots;
}
