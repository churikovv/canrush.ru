'use server';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { catalogGroupSlug } from '@/lib/catalog-query';
import { DrinkQuestionError } from '@/lib/drink-question-fields';
import { answerDrinkQuestion, askDrinkQuestion, deleteDrinkAnswer, deleteDrinkQuestion } from '@/lib/drink-questions';
import { MEMBER_BLOCKED_MESSAGE, isMemberBlockedError } from '@/lib/member-blocks';
import { frozenMessage, isFrozenError } from '@/lib/moderation';

/** `sent` changes on every success, so the form clears itself and shows its toast again. */
export interface QuestionState { error?: string; sent?: number }

/** The drink page and the feeds that show questions. */
function refresh(drink: { brand: string; flavor: string }) {
  revalidatePath(`/catalog/${catalogGroupSlug(drink.brand, drink.flavor)}`);
  revalidatePath('/feed');
  revalidatePath('/');
}

async function post(work: (userId: string) => Promise<{ brand: string; flavor: string }>): Promise<QuestionState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: 'Войдите, чтобы задать вопрос или ответить.' };
  const frozen = await frozenMessage(session.user.id);
  if (frozen) return { error: frozen };
  try {
    refresh(await work(session.user.id));
    return { sent: Date.now() };
  } catch (error) {
    if (error instanceof DrinkQuestionError) return { error: error.message };
    if (isFrozenError(error)) return { error: await frozenMessage(session.user.id) ?? 'Аккаунт заморожен.' };
    if (isMemberBlockedError(error)) return { error: MEMBER_BLOCKED_MESSAGE };
    throw error;
  }
}

export async function askQuestionAction(brand: string, flavor: string, _state: QuestionState, form: FormData): Promise<QuestionState> {
  return post(userId => askDrinkQuestion(userId, brand, flavor, form.get('text')));
}

export async function answerQuestionAction(questionId: string, _state: QuestionState, form: FormData): Promise<QuestionState> {
  return post(userId => answerDrinkQuestion(userId, questionId, form.get('text')));
}

export async function deleteQuestionAction(kind: 'question' | 'answer', id: string): Promise<{ error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: 'Войдите в аккаунт.' };
  const drink = kind === 'question' ? await deleteDrinkQuestion(session.user.id, id) : await deleteDrinkAnswer(session.user.id, id);
  if (!drink) return { error: kind === 'question' ? 'Вопрос уже удалён.' : 'Ответ уже удалён.' };
  refresh(drink);
  return {};
}
