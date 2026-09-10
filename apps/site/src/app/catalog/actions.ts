'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getPool } from '@/db/pool';
import { auth } from '@/lib/auth';
import { getCatalogGroup } from '@/lib/catalog';
import { catalogGroupSlug } from '@/lib/catalog-query';

export async function toggleFavoriteAction(formData: FormData): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/sign-in');

  const brand = formData.get('brand');
  const flavor = formData.get('flavor');
  if (typeof brand !== 'string' || typeof flavor !== 'string') return;
  if (brand.length > 120 || flavor.length > 80) return;

  const group = await getCatalogGroup(brand, flavor);
  if (!group) return;

  const client = await getPool().connect();
  try {
    await client.query('begin');
    const deleted = await client.query(
      `delete from "favorite" where "userId" = $1 and "brand" = $2 and "flavor" = $3 returning 1`,
      [session.user.id, brand, flavor],
    );
    if (deleted.rowCount === 0) {
      await client.query(
        `insert into "favorite" ("userId", "brand", "flavor") values ($1, $2, $3) on conflict do nothing`,
        [session.user.id, brand, flavor],
      );
    }
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }

  revalidatePath(`/catalog/${catalogGroupSlug(brand, flavor)}`);
  revalidatePath('/profile');
  revalidatePath('/profile/favorites');
}
