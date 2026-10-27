/** How long a drink stays in «Новинки» after it first appeared. */
export const NOVELTY_DAYS = 45;
/** The first days of price history are the baseline: what shops had then was already on sale, not new. */
export const NOVELTY_BASELINE_DAYS = 3;

export const noveltyKey = (brand: string, flavor: string) => JSON.stringify([brand, flavor]);

/**
 * The first day each identity shows up in daily snapshots (any city), leaving out those already there in the first
 * `baselineDays` days of history. Dates are `YYYY-MM-DD`; snapshots may come in any order.
 */
export function firstSeenDays(snapshots: { date: string; keys: Iterable<string> }[], baselineDays = NOVELTY_BASELINE_DAYS): Map<string, string> {
  if (!snapshots.length) return new Map();
  const first = new Map<string, string>();
  for (const { date, keys } of snapshots) for (const key of keys) {
    const known = first.get(key);
    if (!known || date < known) first.set(key, date);
  }
  const start = snapshots.reduce((min, { date }) => date < min ? date : min, snapshots[0]!.date);
  const end = new Date(`${start}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + baselineDays);
  const cutoff = end.toISOString().slice(0, 10);
  return new Map([...first].filter(([, date]) => date >= cutoff));
}
