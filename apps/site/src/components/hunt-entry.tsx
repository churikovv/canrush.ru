import Image from 'next/image';
import { TagIcon } from '@/components/hunt-icons';
import Link from '@/components/navigation-progress';
import { huntOpenEvent } from '@/lib/hunt';
import { huntLastDay } from '@/lib/hunt-fields';

/** Баннер в разделе магазинов: добавление оплачивается, пока идёт событие. Цвет и магазин — третья стадия охоты. */
export async function HuntEntry() {
  const event = await huntOpenEvent();
  if (!event) return null;
  return <Link className="hunt-entry" href="/hunt" data-stage="3">
    <span className="hunt-entry-shop"><Image src="/brand/hunt/store-3-cutout.webp" width={360} height={240} sizes="124px" unoptimized priority alt="" /></span>
    <span className="hunt-entry-copy">
      <small><TagIcon size={15} />Оплачиваем добавление магазинов</small>
      <b>Охота за ценниками</b>
      <span>До {huntLastDay(event.endsAt)}: 20 ценников за полный магазин и бонусы сверху. 1 ценник = 1 ₽.</span>
    </span>
    <span className="can-btn hunt-entry-cta">Участвовать</span>
  </Link>;
}
