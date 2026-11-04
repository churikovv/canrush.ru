'use server';

import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { buyShopItem, ShopError, type ShopState } from '@/lib/shop';

export type ShopActionResult = { ok: true; shop: ShopState } | { ok: false; error: string };

/**
 * Buys a look-shop item. No revalidation: the settings page keeps unsaved changes of the preview in the client, and
 * the shop sheet updates its balance from the result; the item becomes wearable at once (`saveProfileCustomization`
 * and `setProfileTags` read the purchase from the database).
 */
export async function buyShopItemAction(key: string): Promise<ShopActionResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, error: 'Войдите в аккаунт и повторите покупку.' };
  try {
    return { ok: true, shop: await buyShopItem(session.user.id, String(key)) };
  } catch (error) {
    if (error instanceof ShopError) return { ok: false, error: error.message };
    throw error;
  }
}
