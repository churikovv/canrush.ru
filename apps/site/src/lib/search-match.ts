function normalize(value: string): string { return value.toLocaleLowerCase('ru').replace(/ё/g, 'е'); }
function distance(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => i ? (j ? 0 : i) : j));
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    rows[i]![j] = Math.min(rows[i - 1]![j]! + 1, rows[i]![j - 1]! + 1, rows[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) rows[i]![j] = Math.min(rows[i]![j]!, rows[i - 2]![j - 2]! + 1);
  }
  return rows[a.length]![b.length]!;
}
export function searchMatches(text: string, query: string): boolean {
  const words = normalize(text).split(/[^a-zа-я0-9]+/u).filter(Boolean);
  const terms = normalize(query).slice(0, 80).split(/[^a-zа-я0-9]+/u).filter(Boolean);
  if (!terms.length) return true;
  if (words.join('').includes(terms.join(''))) return true;
  return terms.every(term => words.some(word => {
    if (word.includes(term)) return true;
    const tolerance = term.length >= 7 ? 2 : term.length >= 4 ? 1 : 0;
    return tolerance > 0 && Math.abs(word.length - term.length) <= tolerance && distance(term, word) <= tolerance;
  }));
}
