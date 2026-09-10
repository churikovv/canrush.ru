'use server';

import { parseSetCookieHeader, toCookieOptions } from 'better-auth/cookies/utils';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getPool } from '@/db/pool';
import { auth } from '@/lib/auth';
import type { ProfileFieldErrors } from '@/lib/profile-fields';
import { validateProfileInput } from '@/lib/profile-fields';
import { getProfileByUserId, isUniqueViolation } from '@/lib/profile';

export interface ProfileFormState {
  message?: string;
  fieldErrors?: ProfileFieldErrors;
}

async function currentUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/sign-in');
  return session.user;
}

async function applyResponseCookies(response: Response): Promise<void> {
  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) return;

  const cookieStore = await cookies();
  for (const [name, attributes] of parseSetCookieHeader(setCookie)) {
    cookieStore.set(name, attributes.value, toCookieOptions(attributes));
  }
}

export async function updateProfileAction(
  _previousState: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const user = await currentUser();
  const validation = validateProfileInput({
    username: String(formData.get('username') ?? ''),
    name: String(formData.get('name') ?? ''),
    telegramChannel: String(formData.get('telegramChannel') ?? ''),
  });

  if (validation.errors) {
    return {
      message: 'Проверьте заполненные поля.',
      fieldErrors: validation.errors,
    };
  }

  const previousProfile = await getProfileByUserId(user.id);

  try {
    await getPool().query(
      `update "user"
       set "username" = $2, "name" = $3, "telegramChannel" = $4, "updatedAt" = now()
       where "id" = $1`,
      [user.id, validation.data.username, validation.data.name, validation.data.telegramChannel],
    );
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        message: 'Этот юзернейм уже занят.',
        fieldErrors: { username: 'Выберите другой юзернейм.' },
      };
    }
    return { message: 'Не удалось сохранить профиль. Попробуйте ещё раз.' };
  }

  revalidatePath('/profile');
  revalidatePath('/profile/edit');
  revalidatePath(`/profile/${validation.data.username}`);
  if (previousProfile?.username && previousProfile.username !== validation.data.username) {
    revalidatePath(`/profile/${previousProfile.username}`);
  }
  redirect('/profile');
}

export async function deleteAccountAction(formData: FormData): Promise<never> {
  const user = await currentUser();
  if (formData.get('confirmation') !== 'delete-account') redirect('/profile/edit');

  const requestHeaders = await headers();
  const signOutResponse = await auth.api.signOut({
    headers: new Headers(requestHeaders),
    asResponse: true,
  });

  await getPool().query('delete from "user" where "id" = $1', [user.id]);
  await applyResponseCookies(signOutResponse);
  redirect('/sign-in?account=deleted');
}
