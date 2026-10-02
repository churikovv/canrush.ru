import { cookies } from 'next/headers';
import { CITY_COOKIE, DEFAULT_CITY, findCity } from '@canrush/shared';
export async function selectedCity() {
  return findCity((await cookies()).get(CITY_COOKIE)?.value) ?? DEFAULT_CITY;
}
