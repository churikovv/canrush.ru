/** Rules of drink questions and answers shared by the browser and the server. */
export const QUESTION_MIN = 5;
export const QUESTION_MAX = 500;
export const ANSWER_MAX = 1000;
/** Between two questions or answers of one member, as between comments. */
export const QUESTION_PAUSE_SECONDS = 15;
/** Questions a drink page shows; older ones stay in the database and the feed. */
export const QUESTIONS_SHOWN = 30;

export class DrinkQuestionError extends Error {}

/** Spaces inside a line collapse, line breaks stay (at most one empty line in a row). */
function cleanText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\r\n?/gu, '\n').replace(/[^\S\n]+/gu, ' ').replace(/ *\n */gu, '\n').replace(/\n{3,}/gu, '\n\n').trim();
}

export function parseQuestionText(value: unknown): string {
  const text = cleanText(value);
  if (text.length < QUESTION_MIN) throw new DrinkQuestionError(`Вопрос — от ${QUESTION_MIN} символов.`);
  if (text.length > QUESTION_MAX) throw new DrinkQuestionError(`Вопрос — до ${QUESTION_MAX} символов.`);
  return text;
}

export function parseAnswerText(value: unknown): string {
  const text = cleanText(value);
  if (!text) throw new DrinkQuestionError('Напишите ответ.');
  if (text.length > ANSWER_MAX) throw new DrinkQuestionError(`Ответ — до ${ANSWER_MAX} символов.`);
  return text;
}

export function questionsWord(count: number) {
  const ones = count % 10, tens = count % 100;
  if (ones === 1 && tens !== 11) return 'вопрос';
  if (ones >= 2 && ones <= 4 && (tens < 12 || tens > 14)) return 'вопроса';
  return 'вопросов';
}

export function answersWord(count: number) {
  const ones = count % 10, tens = count % 100;
  if (ones === 1 && tens !== 11) return 'ответ';
  if (ones >= 2 && ones <= 4 && (tens < 12 || tens > 14)) return 'ответа';
  return 'ответов';
}
