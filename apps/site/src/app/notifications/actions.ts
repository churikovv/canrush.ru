'use server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { selectedCity } from '@/lib/location';
import { readCityCatalog } from '@/lib/catalog-files';
import { getNotifications, readNotifications, syncFavoritePrices } from '@/lib/notifications';
import { PHOTO_ID_PATTERN } from '@/lib/review-photo-limits';
import { selectCityAction } from '@/app/location/actions';
import { findCity } from '@canrush/shared';
import { getPool } from '@/db/pool';

export async function notificationAction(action: 'list' | 'read' | 'read-all' = 'list', id?: string, before?: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { authenticated: false as const };
  if (!['list','read','read-all'].includes(action) || (id && !PHOTO_ID_PATTERN.test(id)) || (before && !PHOTO_ID_PATTERN.test(before)) || (action==='read' && !id)) return { error: 'Некорректное уведомление.' };
  try {
    if (action==='read') {
      const own = await getPool().query('select kind,payload from notification where id=$1 and "userId"=$2',[id,session.user.id]);
      if (!own.rowCount) return { error: 'Уведомление уже удалено.' };
      if (own.rows[0].kind==='price') {
        const city = findCity(own.rows[0].payload.city);
        if (city) await selectCityAction(city.id);
      }
      await readNotifications(session.user.id,id);
    } else if (action==='read-all') await readNotifications(session.user.id);
    let priceWarning: string | undefined;
    if (action==='list' && !before) {
      try {
        const city = await selectedCity();
        await syncFavoritePrices(session.user.id,city,await readCityCatalog(city.id));
      } catch { priceWarning = 'Сейчас не удалось проверить цены избранного.'; }
    }
    return { authenticated: true as const, ...await getNotifications(session.user.id,before), priceWarning };
  } catch { return { error: 'Не удалось загрузить уведомления. Попробуйте ещё раз.' }; }
}
