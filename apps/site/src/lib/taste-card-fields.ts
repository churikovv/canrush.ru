/**
 * «Твой вкус» в конце колоды дейтинга: что человек выбирает, по его же решениям. Без базы: сигналы собирает
 * `taste-card.ts`. Свайп вправо — «нравится», влево — «нет»; избранное — «нравится»; оценка вкуса 7+ — «нравится»,
 * 4 и ниже — «нет», остальное не в счёт. Один напиток — одно решение: оценка важнее избранного, избранное — свайпа.
 *
 * Вкусы — семейства из ключа вкуса (`mango`, `blueberry`, `cola`…), доля «нравится» сглажена (+1 из +2), чтобы один
 * лайк не делал вкус любимым. Архетип — семейство с лучшей долей, без сахара — отдельная пометка.
 */
import { canonicalProductFlavor } from '@canrush/shared';

/** Решений меньше — карточки нет: про вкус ещё нечего сказать. */
export const TASTE_CARD_MIN = 10;

export interface TasteSignal { brand: string; flavor: string; liked: boolean; source: 'review' | 'favorite' | 'swipe' }
export interface TasteFlavor { key: string; label: string; liked: number; total: number }
export interface TasteCard {
  decisions: number; likes: number;
  title: string; lead: string;
  loves: TasteFlavor[]; avoids: TasteFlavor[];
  brand: { name: string; likes: number } | null;
  sugarfree: 'loves' | 'avoids' | null;
}

const FLAVORS: Record<string, string> = {
  apple: 'Яблоко', pear: 'Груша', peach: 'Персик', watermelon: 'Арбуз', melon: 'Дыня',
  mango: 'Манго', pineapple: 'Ананас', lychee: 'Личи', guava: 'Гуава', passion_fruit: 'Маракуйя', coconut: 'Кокос', tropical: 'Тропики',
  cherry: 'Вишня', berry: 'Ягоды', blueberry: 'Черника', raspberry: 'Малина', strawberry: 'Клубника', grape: 'Виноград', pomegranate: 'Гранат',
  citrus: 'Цитрус', lemon: 'Лимон', lime: 'Лайм', orange: 'Апельсин', grapefruit: 'Грейпфрут',
  cola: 'Кола', original: 'Классика',
};
const FAMILIES: { title: string; lead: string; keys: string[] }[] = [
  { title: 'Ягодный', lead: 'Чаще всего выбираешь ягоды', keys: ['berry', 'blueberry', 'raspberry', 'strawberry', 'cherry', 'grape', 'pomegranate'] },
  { title: 'Тропический', lead: 'Тянет к тропикам: манго, ананас и всё яркое', keys: ['mango', 'pineapple', 'lychee', 'guava', 'passion_fruit', 'coconut', 'tropical'] },
  { title: 'Цитрусовый', lead: 'Любишь кислинку цитрусов', keys: ['citrus', 'lemon', 'lime', 'orange', 'grapefruit'] },
  { title: 'Фруктовый', lead: 'Садовые фрукты: яблоко, персик, груша', keys: ['apple', 'pear', 'peach', 'watermelon', 'melon'] },
  { title: 'Классик', lead: 'Верен классическому вкусу энергетика', keys: ['original', 'cola'] },
];

const rate = (liked: number, total: number) => (liked + 1) / (total + 2);
const sugarFree = (flavor: string) => /(^|:)(sugarfree|sweetener)\b/.test(flavor);

/** Семейства вкуса в ключе: `blend:mango+peach:sugarfree` → манго и персик. */
export function flavorFamilies(brand: string, flavor: string): string[] {
  const words = canonicalProductFlavor(brand, flavor).toLowerCase().replace(/passion_fruit/g, 'passionfruit').split(/[^a-z]+/).filter(Boolean)
    .map(word => (word === 'passionfruit' ? 'passion_fruit' : word === 'classic' ? 'original' : word));
  return [...new Set(words.filter(word => word in FLAVORS))];
}

/** Одно решение на напиток, по старшинству: оценка, избранное, свайп. */
function decisions(signals: readonly TasteSignal[]) {
  const order = { review: 3, favorite: 2, swipe: 1 } as const;
  const kept = new Map<string, TasteSignal>();
  for (const signal of signals) {
    const key = JSON.stringify([signal.brand, canonicalProductFlavor(signal.brand, signal.flavor)]);
    const known = kept.get(key);
    if (!known || order[signal.source] > order[known.source]) kept.set(key, signal);
  }
  return [...kept.values()];
}

export function tasteCard(signals: readonly TasteSignal[]): TasteCard | null {
  const items = decisions(signals);
  if (items.length < TASTE_CARD_MIN) return null;
  const likes = items.filter(item => item.liked).length;

  const counts = new Map<string, { liked: number; total: number }>();
  const brands = new Map<string, { liked: number; total: number }>();
  const sugar = { liked: 0, total: 0 };
  for (const item of items) {
    for (const key of flavorFamilies(item.brand, item.flavor)) {
      const entry = counts.get(key) ?? { liked: 0, total: 0 };
      entry.total++; entry.liked += Number(item.liked);
      counts.set(key, entry);
    }
    const brand = brands.get(item.brand) ?? { liked: 0, total: 0 };
    brand.total++; brand.liked += Number(item.liked);
    brands.set(item.brand, brand);
    if (sugarFree(canonicalProductFlavor(item.brand, item.flavor))) { sugar.total++; sugar.liked += Number(item.liked); }
  }
  const flavors = [...counts].map(([key, entry]): TasteFlavor => ({ key, label: FLAVORS[key]!, ...entry }));
  const loves = flavors.filter(item => item.liked >= 2 && rate(item.liked, item.total) >= 0.5)
    .sort((a, b) => rate(b.liked, b.total) - rate(a.liked, a.total) || b.liked - a.liked).slice(0, 3);
  const avoids = flavors.filter(item => item.total >= 3 && rate(item.liked, item.total) <= 0.3 && !loves.includes(item))
    .sort((a, b) => rate(a.liked, a.total) - rate(b.liked, b.total) || b.total - a.total).slice(0, 2);

  const family = FAMILIES.map(entry => {
    const liked = entry.keys.reduce((sum, key) => sum + (counts.get(key)?.liked ?? 0), 0);
    const total = entry.keys.reduce((sum, key) => sum + (counts.get(key)?.total ?? 0), 0);
    return { entry, liked, score: rate(liked, total) };
  }).filter(item => item.liked >= 2).sort((a, b) => b.score - a.score || b.liked - a.liked)[0];
  const picky = likes / items.length < 0.15;
  const [title, lead] = picky ? ['Придирчивый', 'Нравится редко — зато по-настоящему']
    : family && family.score >= 0.4 ? [family.entry.title, family.entry.lead]
    : ['Всеядный', 'Пробуешь всё подряд и находишь хорошее в разном'];

  const favourite = [...brands].filter(([, entry]) => entry.liked >= 2).sort(([a, x], [b, y]) => y.liked - x.liked || rate(y.liked, y.total) - rate(x.liked, x.total) || a.localeCompare(b))[0];
  return {
    decisions: items.length, likes, title, lead, loves, avoids,
    brand: favourite ? { name: favourite[0], likes: favourite[1].liked } : null,
    sugarfree: sugar.total >= 3 ? (rate(sugar.liked, sugar.total) >= 0.5 ? 'loves' : rate(sugar.liked, sugar.total) <= 0.25 ? 'avoids' : null) : null,
  };
}
