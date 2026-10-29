import { flavorName } from '@/lib/catalog-query';
import { splitDrinkFlavorKey } from '@/lib/catalog-drink-fields';

/**
 * Rules of the neural network's duplicate check of a member's drink (`drink-duplicate-check.ts`), without the database
 * or the model: which catalog cards it is compared with, the prompt and how the answer is read. A verdict is a hint for
 * moderators, never a decision.
 */
/**
 * `titles` — product names the shops gave (`offerTitles`): they say what the can is better than our flavour key.
 * `cover` — the card's cover, for the photo check; `hint` — why a candidate was put on the list (same photo, the
 * flavour is part of its mix), shown to the model.
 */
export interface DrinkToCheck { brand: string; flavor: string; fullName?: string; ingredients?: string; titles?: string[]; cover?: string; offers?: number }
export interface DuplicateCandidate { brand: string; flavor: string; fullName?: string; kind: 'shop' | 'archive' | 'member'; titles?: string[]; cover?: string; hint?: string; offers?: number }

/** A card shops barely know: archived or at most two offers — the usual shape of a twin left behind. */
export const isThinCard = (card: { kind?: DuplicateCandidate['kind']; offers?: number }) => card.kind === 'archive' || (card.offers ?? 0) <= 2;
export type DuplicateVerdict = 'duplicate' | 'unsure' | 'new' | 'failed';
export interface DuplicateResult { verdict: DuplicateVerdict; match: DuplicateCandidate | null; reason: string }

/**
 * The duplicate check's algorithm. Rows an older one wrote «new» or «failed» are checked again by the worker — raise it
 * when the check learns something that could change those answers (2: shop names, photos and the mix rule).
 */
export const DUPLICATE_CHECK_VERSION = 2;

/**
 * The hints the check gives the model — shop product names, «одинаковое фото банки», «вкус входит в микс» — and what
 * follows from them: a «new» answer turned into «unsure» by a photo twin or a mix, the other card of a hinted pair asked
 * again, a card asked again when its shop names or cover change. Off since 29.10.2026: with them the model merged a
 * flavour into a mix that has it («Ягодный» into «Ягоды + Малина») and flooded the queue with look-alikes. The code stays
 * for a better try; with the switch off the check works as before them (migration 0147 cleared their answers).
 */
export const DUPLICATE_HINTS = false;

/** What the model sees of a parser card besides its name, as one string: a change means the card is worth another look. */
export const cardInputs = (card: { titles?: string[]; cover?: string; offers?: number }) =>
  JSON.stringify([[...(card.titles ?? [])].sort(), card.cover ?? '', (card.offers ?? 0) > 0]);

/** Cards shown to the model at once: a long list adds noise and, now and then, trips the model's content filter. */
export const DUPLICATE_SHORTLIST = 15;

/** Words every energy drink's name has: they say nothing about which can it is. */
const STOP_WORDS = new Set(['energy', 'drink', 'энергетик', 'энергетический', 'энергетическии', 'напиток', 'тонизирующий', 'газированный', 'безалкогольный', 'пастеризованный',
  'blend', 'sugarfree', 'sweetener', 'juice', 'без', 'сахара', 'вкусом', 'банка', 'ж/б']);

/**
 * Product names the shops gave a card's offers, at most `limit`: Едадил keeps the name in the search address
 * (`text`), Лавка — in the product's address. Volumes and the generic words stay; repeats go.
 */
export function offerTitles(offers: { url: string }[], limit = 3): string[] {
  const titles: string[] = [];
  for (const offer of offers) {
    let title: string | null = null;
    try {
      const url = new URL(offer.url);
      title = url.searchParams.get('text') ?? (url.hostname.endsWith('lavka.yandex.ru') ? decodeURIComponent(url.pathname.split('/').filter(Boolean).at(-1) ?? '').replace(/-/gu, ' ') : null);
    } catch { /* not an address */ }
    const clean = title?.replace(/\s+/gu, ' ').trim().slice(0, 100);
    if (clean && !titles.some(known => known.toLowerCase() === clean.toLowerCase())) titles.push(clean);
    if (titles.length >= limit) break;
  }
  return titles;
}

/**
 * Two flavour keys where one flavour is a part of the other's mix — Арбуз and Дыня + Арбуз, Вишня and Ягодный +
 * Вишня — with the same sugar and juice marks. Most twins the moderators found were such pairs. «Оригинальный» is left
 * out: «Оригинальный + Ваниль» is a line of its own, not a twin of the original can.
 */
export function isFlavorInMix(a: string, b: string): boolean {
  const left = splitDrinkFlavorKey(a), right = splitDrinkFlavorKey(b);
  if (left.sugar !== right.sugar || left.juice !== right.juice) return false;
  const small = left.parts.length <= right.parts.length ? left.parts : right.parts;
  const big = small === left.parts ? right.parts : left.parts;
  return small.length > 0 && small.length < big.length && !small.includes('original') && small.every(part => big.includes(part));
}

/** Bits that differ between two 64-bit photo fingerprints (16 hex digits each). */
export function hammingDistance(a: string, b: string): number {
  let distance = 0;
  for (let i = 0; i < 16; i += 4) {
    let x = parseInt(a.slice(i, i + 4), 16) ^ parseInt(b.slice(i, i + 4), 16);
    while (x) { distance += x & 1; x >>= 1; }
  }
  return distance;
}

/** Photos at most this many bits apart are the same picture (re-encoded or resized). */
export const PHOTO_TWIN_DISTANCE = 6;

const KIND_LABEL: Record<DuplicateCandidate['kind'], string> = { shop: 'карточка магазина', archive: 'архив', member: 'напиток участника' };

export const drinkLabel = (drink: { brand: string; flavor: string; fullName?: string }) =>
  `${drink.brand} · ${flavorName(drink.flavor)}${drink.fullName ? ` («${drink.fullName}»)` : ''}`;

const words = (drink: { flavor: string; fullName?: string; titles?: string[] }) => new Set(
  `${flavorName(drink.flavor)} ${drink.flavor} ${drink.fullName ?? ''} ${DUPLICATE_HINTS ? (drink.titles ?? []).join(' ') : ''}`.toLowerCase().replace(/ё/gu, 'е')
    .split(/[^\p{L}\p{N}]+/u).filter(word => word.length > 2 && !STOP_WORDS.has(word)),
);

/**
 * The cards of the same brand most like the drink, at most `limit`: by shared words of the flavour name, its key and the
 * full name. A brand with few cards goes whole.
 */
export function shortlistCandidates(drink: DrinkToCheck, candidates: DuplicateCandidate[], limit = DUPLICATE_SHORTLIST): DuplicateCandidate[] {
  const brand = drink.brand.toLowerCase();
  const same = candidates.filter(candidate => candidate.brand.toLowerCase() === brand && !(candidate.brand === drink.brand && candidate.flavor === drink.flavor));
  if (same.length <= limit) return same;
  const hinted = same.filter(candidate => candidate.hint);
  const own = words(drink);
  const score = (candidate: DuplicateCandidate) => [...words(candidate)].filter(word => own.has(word) || [...own].some(other => other.length > 3 && (other.includes(word) || word.includes(other)))).length;
  const ranked = same.filter(candidate => !candidate.hint).map((candidate, index) => ({ candidate, index, score: score(candidate) }))
    .sort((a, b) => b.score - a.score || a.index - b.index).map(item => item.candidate);
  return [...hinted, ...ranked].slice(0, Math.max(limit, hinted.length));
}

/** What the model is told of the hints, only while they are on (`DUPLICATE_HINTS`). */
const HINT_RULES = `У карточек бывают названия товаров из магазинов («в магазинах: …»). Они точнее нашего вкуса: если они описывают ту же банку (например «Watermelon с арбузом и дыней» и «Дыня + Арбуз», «цитрус микс» и «апельсин грейпфрут лимон»), это дубль, даже если вкусы в каталоге записаны по-разному.
Подсказка у карточки («одинаковое фото банки», «вкус входит в микс») — повод присмотреться, но не доказательство: у разных вкусов бывает общее фото.
`;

export const DUPLICATE_SYSTEM = (hintRules => `Ты помогаешь модератору каталога энергетиков. Участник прислал напиток. Тебе дают список карточек того же бренда, которые уже есть в каталоге.
Реши, это та же банка, что одна из карточек (дубль), или новый напиток.
Дубль — тот же продукт под другим написанием: перевод названия вкуса (Storm = «Шторм»), маркетинговое имя линейки вместо вкуса, лишнее слово energy, другой порядок слов.
${hintRules}НЕ дубль: другой вкус; версия без сахара (zero, sugar free) против обычной; версия с сахарозаменителем против обычной; версия с соком против обычной; другая линейка бренда (Ultra, Reserve, Rehab, Java у Monster — разные продукты).
Если не уверен — ответ unsure. Отвечай только JSON без пояснений вокруг:
{"verdict":"duplicate"|"new"|"unsure","match":<номер карточки или null>,"reason":"<коротко, по-русски>"}`)(DUPLICATE_HINTS ? HINT_RULES : '');

export function duplicatePrompt(drink: DrinkToCheck, candidates: DuplicateCandidate[]): string {
  const shops = (titles?: string[]) => DUPLICATE_HINTS && titles?.length ? `; в магазинах: ${titles.map(title => `«${title}»`).join(', ')}` : '';
  const list = candidates.map((candidate, index) => `${index + 1}. ${drinkLabel(candidate)} — ${KIND_LABEL[candidate.kind]}${shops(candidate.titles)}${DUPLICATE_HINTS && candidate.hint ? `; подсказка: ${candidate.hint}` : ''}`).join('\n');
  const label = drink.ingredients?.trim() ? `\nСостав с этикетки: ${drink.ingredients.trim().slice(0, 300)}` : '';
  return `Новый напиток: ${drinkLabel(drink)}${shops(drink.titles)}${label}\n\nКарточки бренда в каталоге:\n${list || '(нет)'}`;
}

/**
 * The sugar and juice marks of a flavour key: versions with different marks are different drinks by the catalog's
 * rules. The parser also writes a plain `sugarfree` key for a brand's zero can — Gorilla «Без сахара» is not its original.
 */
const marks = (flavor: string) => `${flavor.includes(':juice') ? 'juice' : ''}|${flavor === 'sugarfree' || flavor.endsWith(':sugarfree') ? 'free' : flavor.endsWith(':sweetener') ? 'sweetener' : ''}`;

/**
 * The model's answer as a verdict, or null when it is not one (the content filter's canned reply, broken JSON, a card
 * number outside the list). A «duplicate» of a card with other sugar or juice marks is only «unsure»: the catalog keeps
 * such versions apart, and the model mixes them up now and then.
 */
export function parseDuplicateAnswer(raw: string, candidates: DuplicateCandidate[], drink: DrinkToCheck): DuplicateResult | null {
  const json = raw.match(/\{[\s\S]*\}/u)?.[0];
  if (!json) return null;
  let answer: { verdict?: unknown; match?: unknown; reason?: unknown };
  try { answer = JSON.parse(json) as typeof answer; } catch { return null; }
  if (answer.verdict !== 'duplicate' && answer.verdict !== 'new' && answer.verdict !== 'unsure') return null;
  const reason = typeof answer.reason === 'string' ? answer.reason.replace(/\s+/gu, ' ').trim().slice(0, 300) : '';
  const index = typeof answer.match === 'number' ? answer.match : typeof answer.match === 'string' && /^\d+$/u.test(answer.match) ? Number(answer.match) : null;
  const match = index !== null ? candidates[index - 1] ?? null : null;
  if (answer.verdict === 'new') return { verdict: 'new', match: null, reason };
  if (index !== null && !match) return null;
  if (answer.verdict === 'duplicate' && !match) return null;
  if (answer.verdict === 'duplicate' && match && marks(match.flavor) !== marks(drink.flavor)) {
    return { verdict: 'unsure', match, reason: `Отличается отметка сахара или сока. ${reason}`.trim() };
  }
  return { verdict: answer.verdict, match, reason };
}

/** Several answers for parts of a list (after the filter refused the whole): a duplicate wins, then unsure, then new. */
export function combineDuplicateResults(results: (DuplicateResult | null)[]): DuplicateResult {
  const answered = results.filter((result): result is DuplicateResult => result !== null);
  return answered.find(result => result.verdict === 'duplicate') ?? answered.find(result => result.verdict === 'unsure')
    ?? (answered.length === results.length && answered.length ? answered[0]! : { verdict: 'failed', match: null, reason: 'Нейросеть не ответила по существу.' });
}

/**
 * Two answers to the same question. The model is not steady on borderline cards (the same prompt gave «duplicate» two
 * times in six), so the check asks twice: both «duplicate» of the same card — a duplicate; any other hint of one — only
 * «unsure» with that card, since a hint the moderator dismisses costs less than a twin nobody sees.
 */
export function mergeDuplicateVotes(votes: DuplicateResult[]): DuplicateResult {
  const hints = votes.filter(vote => vote.verdict === 'duplicate' || vote.verdict === 'unsure');
  if (!hints.length) return votes[0] ?? { verdict: 'failed', match: null, reason: 'Нейросеть не ответила по существу.' };
  const first = hints.find(vote => vote.verdict === 'duplicate') ?? hints[0]!;
  const agreed = votes.length > 1 && votes.every(vote => vote.verdict === 'duplicate' && vote.match === first.match);
  return agreed || (votes.length === 1 && first.verdict === 'duplicate') ? first : { ...first, verdict: 'unsure' };
}

/** Answers asked for an automatic merge: all of them must name the same card as a duplicate. */
export const CONFIDENT_VOTES = 3;

/**
 * Sure enough to merge without a moderator: `CONFIDENT_VOTES` answers, every one a «duplicate» of the same card (a card
 * with other sugar or juice marks is never one — `parseDuplicateAnswer` turns it into «unsure»).
 */
export function isConfidentDuplicate(votes: (DuplicateResult | null)[]): boolean {
  const first = votes[0];
  return votes.length >= CONFIDENT_VOTES && !!first?.match && votes.every(vote => vote?.verdict === 'duplicate' && vote.match === first.match);
}
