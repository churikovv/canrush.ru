'use server';
import { revalidatePath } from 'next/cache';
import { requireFullAdmin } from '@/lib/admin';
import { findContest } from '@/lib/contest';
import { confirmContestWinner, ContestError, drawContestWinner, redrawContestWinner } from '@/lib/contest-db';

export interface ContestActionState { error?: string; success?: string }

async function run(key: string, work: (contest: NonNullable<ReturnType<typeof findContest>>, email: string) => Promise<string>): Promise<ContestActionState> {
  const admin = await requireFullAdmin();
  const contest = findContest(key);
  if (!contest) return { error: 'Конкурс не найден.' };
  try {
    const success = await work(contest, admin.email);
    revalidatePath('/admin/contest', 'layout');
    return { success };
  } catch (error) { return { error: error instanceof ContestError ? error.message : 'Не получилось. Попробуйте ещё раз.' }; }
}

export async function drawContestAction(key: string, _previous: ContestActionState, form: FormData): Promise<ContestActionState> {
  return run(key, async (contest, email) => {
    const draw = await drawContestWinner(contest, email, { telegram: form.get('telegram') === 'on', avatar: form.get('avatar') === 'on' });
    return `Победитель: ${draw.winnerLabel} — из ${draw.poolSize}. Напишите ему и отметьте результат.`;
  });
}

export async function redrawContestAction(key: string, _previous: ContestActionState, form: FormData): Promise<ContestActionState> {
  return run(key, async (contest, email) => {
    const draw = await redrawContestWinner(contest, email, String(form.get('drawId') ?? ''));
    return `Переиграли. Новый победитель: ${draw.winnerLabel} — из ${draw.poolSize}.`;
  });
}

export async function confirmContestAction(key: string, _previous: ContestActionState, form: FormData): Promise<ContestActionState> {
  return run(key, async (contest, email) => {
    await confirmContestWinner(contest, email, String(form.get('drawId') ?? ''));
    return contest.tag ? `Победитель подтверждён, тег «${contest.tagLabel ?? contest.tag}» выдан.` : 'Победитель подтверждён.';
  });
}
