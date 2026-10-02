'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getPool } from '@/db/pool';
import { auth } from '@/lib/auth';
import { getProfileCommunity } from '@/lib/profile-community';
import { loadAllCatalogGroups } from '@/lib/catalog';
import { isUserBlocked } from '@/lib/moderation';
import { ensureOwnProfile } from '@/lib/profile';
import { validateTierListInput, type TierListFieldErrors } from '@/lib/tier-list-fields';
import { TIER_KEYS, type TierListPlacement, type TierListStatus } from '@/lib/tier-list-types';
import { getTierListBySlug } from '@/lib/tier-lists';

export interface TierListFormState {
  status?: 'error';
  message?: string;
  fieldErrors?: TierListFieldErrors;
}

function itemKey(brand: string, flavor: string): string {
  return `${brand}\u0000${flavor}`;
}

function normalizePositions(items: TierListPlacement[]): TierListPlacement[] {
  return TIER_KEYS.flatMap((tier) =>
    items
      .filter((item) => item.tier === tier)
      .sort((left, right) => left.position - right.position)
      .map((item, position) => ({ ...item, position })),
  );
}

async function requireUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/sign-in');
  const profile = await ensureOwnProfile(session.user);
  return { user: session.user, profile };
}

function newTierListSlug(): string {
  return `tier-${randomUUID().replaceAll('-', '').slice(0, 12)}`;
}

export async function saveTierListAction(
  _previousState: TierListFormState,
  formData: FormData,
): Promise<TierListFormState> {
  const { user, profile } = await requireUser();
  if (await isUserBlocked(user.id)) {
    return { status: 'error', message: 'Ваш аккаунт заблокирован для создания и изменения тирлистов.' };
  }
  const requestedSlug = String(formData.get('slug') ?? '');
  const intent = formData.get('intent') === 'publish' ? 'publish' : 'save';
  const validation = validateTierListInput({
    title: String(formData.get('title') ?? ''),
    items: String(formData.get('items') ?? ''),
  });

  if (validation.errors) {
    return { status: 'error', message: 'Проверьте название и расположение товаров.', fieldErrors: validation.errors };
  }
  if (intent === 'publish' && validation.data.items.length === 0) {
    return {
      status: 'error',
      message: 'Добавьте хотя бы один энергетик перед публикацией.',
      fieldErrors: { items: 'Распределите хотя бы один товар.' },
    };
  }

  const existing = requestedSlug ? await getTierListBySlug(requestedSlug) : null;
  if (requestedSlug && (!existing || existing.userId !== user.id)) {
    return { status: 'error', message: 'Тирлист не найден или недоступен для редактирования.' };
  }

  const groups = await loadAllCatalogGroups();
  const allowedProducts = new Set(groups.map((group) => itemKey(group.brand, group.flavor)));
  for (const item of existing?.items ?? []) allowedProducts.add(itemKey(item.brand, item.flavor));
  if (validation.data.items.some((item) => !allowedProducts.has(itemKey(item.brand, item.flavor)))) {
    return { status: 'error', message: 'Один из товаров больше не доступен в каталоге. Обновите страницу.' };
  }

  const items = normalizePositions(validation.data.items);
  const status: TierListStatus = intent === 'publish' ? 'published' : (existing?.status ?? 'draft');
  const slug = existing?.slug ?? newTierListSlug();
  const client = await getPool().connect();

  try {
    await client.query('begin');
    let tierListId = existing?.id;
    if (tierListId) {
      const updated = await client.query(
        `update "tierList"
         set "title" = $3,
             "status" = $4,
             "updatedAt" = current_timestamp,
             "publishedAt" = case
               when $4 = 'published' then coalesce("publishedAt", current_timestamp)
               else "publishedAt"
             end
         where "id" = $1 and "userId" = $2`,
        [tierListId, user.id, validation.data.title, status],
      );
      if (updated.rowCount !== 1) throw new Error('Tier list ownership changed');
      await client.query('delete from "tierListItem" where "tierListId" = $1', [tierListId]);
    } else {
      const inserted = await client.query<{ id: string }>(
        `insert into "tierList" ("userId", "slug", "title", "status", "publishedAt")
         values ($1, $2, $3, $4, case when $4 = 'published' then current_timestamp else null end)
         returning "id"`,
        [user.id, slug, validation.data.title, status],
      );
      tierListId = inserted.rows[0]?.id;
      if (!tierListId) throw new Error('Tier list was not created');
    }

    if (items.length > 0) {
      const values: unknown[] = [];
      const placeholders = items.map((item, index) => {
        const offset = index * 5;
        values.push(tierListId, item.brand, item.flavor, item.tier, item.position);
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`;
      });
      await client.query(
        `insert into "tierListItem" ("tierListId", "brand", "flavor", "tier", "position")
         values ${placeholders.join(', ')}`,
        values,
      );
    }

    await client.query('commit');
  } catch {
    await client.query('rollback');
    return { status: 'error', message: 'Не удалось сохранить тирлист. Попробуйте ещё раз.' };
  } finally {
    client.release();
  }

  await getProfileCommunity(user.id);

  revalidatePath('/tierlists');
  revalidatePath(`/tierlists/${slug}`);
  revalidatePath(`/tierlists/${slug}/edit`);
  revalidatePath('/profile');
  revalidatePath('/profile/tierlists');
  revalidatePath(`/profile/${profile.username}`);
  revalidatePath(`/profile/${profile.username}/tierlists`);
  redirect(intent === 'publish' ? `/tierlists/${slug}` : `/tierlists/${slug}/edit?saved=1`);
}

export async function deleteTierListAction(formData: FormData): Promise<void> {
  const { user, profile } = await requireUser();
  const slug = String(formData.get('slug') ?? '').trim();

  if (!slug) redirect('/profile/tierlists');

  const deleted = await getPool().query<{ slug: string }>(
    `delete from "tierList"
     where "slug" = $1 and "userId" = $2
     returning "slug"`,
    [slug, user.id],
  );

  if (deleted.rowCount !== 1) redirect('/profile/tierlists');

  revalidatePath('/tierlists');
  revalidatePath(`/tierlists/${slug}`);
  revalidatePath(`/tierlists/${slug}/edit`);
  revalidatePath('/profile');
  revalidatePath('/profile/tierlists');
  revalidatePath(`/profile/${profile.username}`);
  revalidatePath(`/profile/${profile.username}/tierlists`);
  redirect('/profile/tierlists?deleted=1');
}
