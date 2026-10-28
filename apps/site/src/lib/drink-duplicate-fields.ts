import { flavorName } from '@/lib/catalog-query';

/**
 * Rules of the neural network's duplicate check of a member's drink (`drink-duplicate-check.ts`), without the database
 * or the model: which catalog cards it is compared with, the prompt and how the answer is read. A verdict is a hint for
 * moderators, never a decision.
 */
export interface DrinkToCheck { brand: string; flavor: string; fullName?: string; ingredients?: string }
export interface DuplicateCandidate { brand: string; flavor: string; fullName?: string; kind: 'shop' | 'archive' | 'member' }
export type DuplicateVerdict = 'duplicate' | 'unsure' | 'new' | 'failed';
export interface DuplicateResult { verdict: DuplicateVerdict; match: DuplicateCandidate | null; reason: string }

/** Cards shown to the model at once: a long list adds noise and, now and then, trips the model's content filter. */
export const DUPLICATE_SHORTLIST = 15;

const KIND_LABEL: Record<DuplicateCandidate['kind'], string> = { shop: 'карточка магазина', archive: 'архив', member: 'напиток участника' };

export const drinkLabel = (drink: { brand: string; flavor: string; fullName?: string }) =>
  `${drink.brand} · ${flavorName(drink.flavor)}${drink.fullName ? ` («${drink.fullName}»)` : ''}`;

const words = (drink: { flavor: string; fullName?: string }) => new Set(
  `${flavorName(drink.flavor)} ${drink.flavor} ${drink.fullName ?? ''}`.toLowerCase().replace(/ё/gu, 'е')
    .split(/[^\p{L}\p{N}]+/u).filter(word => word.length > 2 && !['energy', 'энергетик', 'blend', 'sugarfree', 'sweetener', 'juice', 'без', 'сахара'].includes(word)),
);

/**
 * The cards of the same brand most like the drink, at most `limit`: by shared words of the flavour name, its key and the
 * full name. A brand with few cards goes whole.
 */
export function shortlistCandidates(drink: DrinkToCheck, candidates: DuplicateCandidate[], limit = DUPLICATE_SHORTLIST): DuplicateCandidate[] {
  const brand = drink.brand.toLowerCase();
  const same = candidates.filter(candidate => candidate.brand.toLowerCase() === brand && !(candidate.brand === drink.brand && candidate.flavor === drink.flavor));
  if (same.length <= limit) return same;
  const own = words(drink);
  const score = (candidate: DuplicateCandidate) => [...words(candidate)].filter(word => own.has(word) || [...own].some(other => other.length > 3 && (other.includes(word) || word.includes(other)))).length;
  return same.map((candidate, index) => ({ candidate, index, score: score(candidate) }))
    .sort((a, b) => b.score - a.score || a.index - b.index).slice(0, limit).map(item => item.candidate);
}

export const DUPLICATE_SYSTEM = `Ты помогаешь модератору каталога энергетиков. Участник прислал напиток. Тебе дают список карточек того же бренда, которые уже есть в каталоге.
Реши, это та же банка, что одна из карточек (дубль), или новый напиток.
Дубль — тот же продукт под другим написанием: перевод названия вкуса (Storm = «Шторм»), маркетинговое имя линейки вместо вкуса, лишнее слово energy, другой порядок слов.
НЕ дубль: другой вкус; версия без сахара (zero, sugar free) против обычной; версия с сахарозаменителем против обычной; версия с соком против обычной; другая линейка бренда (Ultra, Reserve, Rehab, Java у Monster — разные продукты).
Если не уверен — ответ unsure. Отвечай только JSON без пояснений вокруг:
{"verdict":"duplicate"|"new"|"unsure","match":<номер карточки или null>,"reason":"<коротко, по-русски>"}`;

export function duplicatePrompt(drink: DrinkToCheck, candidates: DuplicateCandidate[]): string {
  const list = candidates.map((candidate, index) => `${index + 1}. ${drinkLabel(candidate)} — ${KIND_LABEL[candidate.kind]}`).join('\n');
  const label = drink.ingredients?.trim() ? `\nСостав с этикетки: ${drink.ingredients.trim().slice(0, 300)}` : '';
  return `Новый напиток: ${drinkLabel(drink)}${label}\n\nКарточки бренда в каталоге:\n${list || '(нет)'}`;
}

/** The sugar and juice marks of a flavour key: versions with different marks are different drinks by the catalog's rules. */
const marks = (flavor: string) => `${flavor.includes(':juice') ? 'juice' : ''}|${flavor.endsWith(':sugarfree') ? 'free' : flavor.endsWith(':sweetener') ? 'sweetener' : ''}`;

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
