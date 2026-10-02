'use server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { CITY_COOKIE, findCity } from '@canrush/shared';
export async function selectCityAction(id: string) {
  const city = findCity(id);
  if (!city) return { error: 'Выберите город из списка.' };
  (await cookies()).set(CITY_COOKIE, city.id, { path: '/', sameSite: 'lax', httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 365 * 24 * 60 * 60 });
  revalidatePath('/', 'layout');
  return { cityId: city.id };
}
