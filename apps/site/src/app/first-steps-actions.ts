'use server';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { claimFirstStep, hideFirstSteps, wearFirstStepReward, type ClaimResult, type ClaimStep } from '@/lib/first-steps';

export async function hideFirstStepsAction() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return;
  await hideFirstSteps(session.user.id);
  revalidatePath('/');
}

const isClaimStep = (step: unknown): step is ClaimStep => step === 'swipes' || step === 'follow';

/**
 * «Забрать» on the home card. No `revalidatePath`: it would redraw the home page under the open reveal and take the card
 * away with it once everything is taken; the card refreshes itself when the reveal closes.
 */
export async function claimFirstStepAction(step: unknown): Promise<ClaimResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, error: 'Войдите, чтобы забрать награду.' };
  if (!isClaimStep(step)) return { ok: false, error: 'Такой награды нет.' };
  try { return await claimFirstStep(session.user.id, step); } catch (error) {
    console.error('first step claim failed', error);
    return { ok: false, error: 'Не удалось забрать награду. Попробуйте ещё раз.' };
  }
}

/** «Надеть» on the reveal when the slot was already taken. */
export async function wearFirstStepAction(step: unknown): Promise<{ error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: 'Войдите, чтобы надеть награду.' };
  if (!isClaimStep(step)) return { error: 'Такой награды нет.' };
  try { return await wearFirstStepReward(session.user.id, step) ? {} : { error: 'Сначала заберите награду.' }; } catch (error) {
    console.error('first step wear failed', error);
    return { error: 'Не удалось надеть. Попробуйте ещё раз или выберите в настройках профиля.' };
  }
}
