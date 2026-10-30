'use server';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { hideFirstSteps } from '@/lib/first-steps';

export async function hideFirstStepsAction() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return;
  await hideFirstSteps(session.user.id);
  revalidatePath('/');
}
