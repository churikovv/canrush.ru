import type { ChatMessage } from '@/lib/gigachat';

/**
 * «Рецензия на отзывы» — GigaChat reads the reviews of one drink and writes a short brief for the brand. Pure rules here:
 * what goes into the prompt (texts and scores only — no names) and how the answer is checked; the model's text is never
 * shown as is.
 */
export const DIGEST_MIN_REVIEWS = 3;
export const DIGEST_MAX_REVIEWS = 60;
/** A drink's brief is rewritten no more often than this, and only when there are new reviews. */
export const DIGEST_COOLDOWN_HOURS = 6;
/** Briefs a company may request a day. */
export const DIGEST_DAILY_LIMIT = 20;

export type DigestSentiment = 'positive' | 'mixed' | 'negative';
export const DIGEST_SENTIMENT_LABELS: Record<DigestSentiment, string> = { positive: 'В целом хвалят', mixed: 'Мнения разделились', negative: 'В целом недовольны' };

export interface ReviewDigest { summary: string; sentiment: DigestSentiment; praise: string[]; complaints: string[]; suggestions: string[] }
export interface DigestReview { taste: number; design: number; text: string }

export function digestPrompt(drink: string, reviews: DigestReview[]): ChatMessage[] {
  const lines = reviews.slice(0, DIGEST_MAX_REVIEWS).map((review, index) =>
    `${index + 1}. Вкус ${review.taste}/10, дизайн ${review.design}/10: ${review.text.replace(/\s+/g, ' ').trim().slice(0, 400)}`);
  return [
    { role: 'system', content: [
      'Ты аналитик отзывов об энергетических напитках. Пишешь короткую рецензию на отзывы покупателей для команды бренда.',
      'Опирайся только на текст отзывов ниже: ничего не выдумывай, не добавляй фактов о составе, цене или производителе.',
      'Пиши по-русски, нейтрально и по делу. Не упоминай авторов.',
      'Не преувеличивай: «большинство» — только если так пишут больше половины отзывов; иначе укажи, сколько примерно',
      '(«в 2 из 5 отзывов», «один отзыв»). Пункты списков — про сам напиток (вкус, сладость, газ, банка, цена, эффект),',
      'а не пересказ оценок вроде «низкая оценка».',
      'Ответь строго одним JSON-объектом без пояснений и без Markdown:',
      '{"summary": "2–3 предложения: общее впечатление", "sentiment": "positive" | "mixed" | "negative",',
      '"praise": ["что хвалят", ...], "complaints": ["на что жалуются", ...], "suggestions": ["что стоит сделать бренду", ...]}',
      'В каждом списке от 0 до 4 коротких пунктов до 120 символов.',
    ].join('\n') },
    { role: 'user', content: `Напиток: ${drink}\nОтзывы (${lines.length}):\n${lines.join('\n')}` },
  ];
}

const clean = (value: unknown, max: number) => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
const list = (value: unknown) => Array.isArray(value) ? value.map(item => clean(item, 160)).filter(Boolean).slice(0, 4) : [];

/** The model's answer as a brief, or null when it is not the JSON asked for (a fenced block is accepted). */
export function parseDigest(answer: string): ReviewDigest | null {
  const start = answer.indexOf('{'), end = answer.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let json: Record<string, unknown>;
  try { json = JSON.parse(answer.slice(start, end + 1)) as Record<string, unknown>; } catch { return null; }
  const summary = clean(json.summary, 600);
  if (!summary) return null;
  const sentiment: DigestSentiment = json.sentiment === 'positive' || json.sentiment === 'negative' ? json.sentiment : 'mixed';
  return { summary, sentiment, praise: list(json.praise), complaints: list(json.complaints), suggestions: list(json.suggestions) };
}
