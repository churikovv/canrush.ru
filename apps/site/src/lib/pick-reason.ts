import type { PickReason } from '@/lib/story-digest';

function plural(value: number, one: string, few: string, many: string) {
  const tens = value % 100, ones = value % 10;
  if (tens >= 11 && tens <= 14) return many;
  return ones === 1 ? one : ones >= 2 && ones <= 4 ? few : many;
}

/** Flavour families from profile-compatibility, as they read in «вкусы с …». */
const FLAVOR_TOKENS: Record<string, string> = {
  apple: 'яблоком', mango: 'манго', peach: 'персиком', pear: 'грушей', lychee: 'личи', cherry: 'вишней', berry: 'ягодами',
  blueberry: 'черникой', raspberry: 'малиной', strawberry: 'клубникой', watermelon: 'арбузом', grapefruit: 'грейпфрутом',
  lemon: 'лимоном', lime: 'лаймом', citrus: 'цитрусом', orange: 'апельсином', pineapple: 'ананасом', guava: 'гуавой',
  passion_fruit: 'маракуйей', pomegranate: 'гранатом', grape: 'виноградом', coconut: 'кокосом',
};
/** Why a drink is suggested, in the words of the «Тебе понравится» story and the dating cards. */
export function pickReason(reason: PickReason): string {
  if (reason.kind === 'similar') return reason.fans
    ? `Нравится ${reason.fans} ${plural(reason.fans, 'человеку', 'людям', 'людям')} с похожим вкусом${reason.match ? ` · сходство ${reason.match}%` : ''}`
    : 'Похоже на то, что тебе нравится';
  if (reason.kind === 'brand') return `Ты высоко оцениваешь ${reason.brand} — этот вкус ещё не пробовал`;
  if (reason.kind === 'flavor') return `Тебе нравятся вкусы с ${FLAVOR_TOKENS[reason.token] ?? reason.token}`;
  return `Средняя оценка вкуса ${reason.taste.toLocaleString('ru-RU')} из 10 · ${reason.reviews} ${plural(reason.reviews, 'отзыв', 'отзыва', 'отзывов')}`;
}

