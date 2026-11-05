import { lockedBrandFrameMessage, ownedBrandFrames } from '@/lib/brand-frame-fields';
import { getBrandFrameProgress } from '@/lib/brand-frames';
import { experienceLevel } from '@/lib/experience-level';
import { canUseProfileAppearance, DEFAULT_PROFILE_APPEARANCE, parseProfileAppearance, type ProfileAppearance } from '@/lib/profile-appearance';
import { type ProfileLayout } from '@/lib/profile-layout';
import sharp from 'sharp';
import { getPool } from '@/db/pool';
import type { ProfileInput } from '@/lib/profile-fields';

export const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;
/** A GIF weighs more than a photo, so it may be up to 10 MB; it is kept as an animated WebP several times lighter. */
export const MAX_ANIMATED_IMAGE_BYTES = 10 * 1024 * 1024;
export const PROFILE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
/** At most this many frames and pixels of all frames together are read: a long GIF keeps its start. */
const MAX_FRAMES = 150;
const MAX_ANIMATED_PIXELS = 40_000_000;
/**
 * An animated avatar or banner is smaller than a still one (a still avatar is 512 px, a banner up to 1920): every frame
 * is stored, and the avatar plays in every list of the site. Width and the largest result; past it, a second, lighter try.
 */
const ANIMATED: Record<ProfileImageKind, { tries: { side: number; quality: number }[]; maxBytes: number }> = {
  avatar: { tries: [{ side: 256, quality: 76 }, { side: 192, quality: 55 }], maxBytes: 1_500_000 },
  banner: { tries: [{ side: 960, quality: 74 }, { side: 720, quality: 52 }], maxBytes: 3_000_000 },
};
export type ProfileImageKind = 'avatar' | 'banner';
export type ProfileImageChanges = Partial<Record<ProfileImageKind, Buffer | null>>;
export class ProfileImageError extends Error {}

export async function prepareProfileImages(form: FormData): Promise<ProfileImageChanges> {
  const images: ProfileImageChanges = {};
  for (const kind of ['avatar', 'banner'] as const) {
    const entries = form.getAll(kind);
    const remove = form.get(`remove-${kind}`) === 'true';
    if (entries.length > 1 || entries.some(entry => typeof entry === 'string')) throw new ProfileImageError('Выберите одно изображение для каждого поля.');
    const file = entries[0] as File | undefined;
    if (!file || file.size === 0) { if (remove) images[kind] = null; continue; }
    if (remove) throw new ProfileImageError('Выберите замену или удаление изображения.');
    if (!PROFILE_IMAGE_TYPES.includes(file.type)) throw new ProfileImageError('Используйте JPG, PNG, WebP или GIF.');
    if (file.size > (file.type === 'image/gif' || file.type === 'image/webp' ? MAX_ANIMATED_IMAGE_BYTES : MAX_PROFILE_IMAGE_BYTES)) throw new ProfileImageError('Фото — до 5 МБ, GIF — до 10 МБ.');
    try {
      const bytes = Buffer.from(await file.arrayBuffer());
      const probe = await sharp(bytes, { limitInputPixels: false, animated: true }).metadata();
      if (!['jpeg', 'png', 'webp', 'gif'].includes(probe.format ?? '')) throw new Error('Invalid format');
      const animated = (probe.pages ?? 1) > 1;
      if (!animated && file.size > MAX_PROFILE_IMAGE_BYTES) throw new ProfileImageError('Фото — до 5 МБ, GIF — до 10 МБ.');
      const frameHeight = probe.pageHeight ?? probe.height;
      // A GIF has no EXIF turn; a photo is turned upright first, and the browser's crop is in its upright coordinates.
      const pages = animated ? Math.max(1, Math.min(MAX_FRAMES, probe.pages ?? 1, Math.floor(MAX_ANIMATED_PIXELS / Math.max(1, probe.width * frameHeight)))) : 1;
      const options = animated ? { limitInputPixels: MAX_ANIMATED_PIXELS, failOn: 'error' as const, animated: true, pages } : { limitInputPixels: 40_000_000, failOn: 'warning' as const };
      const oriented = animated ? { width: probe.width, height: frameHeight } : (await sharp(bytes, options).metadata()).autoOrient;
      let image = animated ? sharp(bytes, options) : sharp(bytes, options).autoOrient();
      const cropInput = form.get(`crop-${kind}`);
      if (cropInput !== null) {
        if (typeof cropInput !== 'string') throw new Error('Invalid crop');
        const crop = JSON.parse(cropInput) as { left: number; top: number; width: number; height: number };
        if (!crop || ![crop.left, crop.top, crop.width, crop.height].every(Number.isSafeInteger)
          || crop.left < 0 || crop.top < 0 || crop.width < 1 || crop.height < 1
          || crop.left + crop.width > oriented.width || crop.top + crop.height > oriented.height
          || Math.abs(crop.width - crop.height * (kind === 'avatar' ? 1 : 4)) > 3) throw new Error('Invalid crop');
        image = image.extract({ left: crop.left, top: crop.top, width: crop.width, height: crop.height });
      }
      if (animated) { images[kind] = await animatedWebp(image, kind); continue; }
      const data = await (kind === 'avatar' ? image.resize(512, 512, { fit: 'cover' }) : image.resize({ width: 1920, height: 1080, fit: 'inside', withoutEnlargement: true }))
        .webp({ quality: 82 }).toBuffer();
      if (data.length > 2 * 1024 * 1024) throw new Error('Output too large');
      images[kind] = data;
    } catch (error) {
      if (error instanceof ProfileImageError) throw error;
      throw new ProfileImageError('Не удалось прочитать изображение. Выберите JPG, PNG, WebP или GIF до 40 мегапикселей.');
    }
  }
  return images;
}

/** A GIF as an animated WebP of every frame, at the size of `ANIMATED`, lighter the second time if the first is too heavy. */
async function animatedWebp(image: ReturnType<typeof sharp>, kind: ProfileImageKind): Promise<Buffer> {
  const { tries, maxBytes } = ANIMATED[kind];
  for (const { side, quality } of tries) {
    const sized = kind === 'avatar' ? image.clone().resize(side, side, { fit: 'cover' }) : image.clone().resize({ width: side, height: Math.round(side * 9 / 16), fit: 'inside', withoutEnlargement: true });
    const data = await sized.webp({ quality, effort: 4 }).toBuffer();
    if (data.length <= maxBytes) return data;
  }
  throw new ProfileImageError(kind === 'avatar' ? 'GIF для аватарки получается слишком тяжёлым: возьмите покороче или поменьше.' : 'GIF для баннера получается слишком тяжёлым: возьмите покороче или поменьше.');
}

export async function saveProfileCustomization(userId: string, input: ProfileInput, images: ProfileImageChanges, layout?: ProfileLayout, appearance?: ProfileAppearance) {
  if (appearance && !parseProfileAppearance(appearance)) throw new ProfileImageError('Некорректное оформление профиля.');
  const client = await getPool().connect();
  try {
    await client.query('begin');
    if (appearance) {
      const existing = await client.query('select "profileAppearance" from "user" where id = $1 for update', [userId]);
      const ranking = await client.query('select xp from "profileRanking" where id = $1', [userId]);
      const level = experienceLevel(Number(ranking.rows[0]?.xp ?? 0)).level;
      const current = parseProfileAppearance(existing.rows[0]?.profileAppearance) ?? DEFAULT_PROFILE_APPEARANCE;
      // Frames owned outside levels: the gacha's exclusives and the look shop's purchases.
      const gacha = (await client.query<{ key: string }>(`select key from "gachaCosmetic" where "userId" = $1 union select key from "shopPurchase" where "userId" = $1
      union select 'charge' from "firstStepReward" where "userId" = $1 and step = 'follow'
      union select item from "dailyReward" where "userId" = $1 and item is not null`, [userId])).rows.map(row => row.key);
      const owned = [...gacha, ...ownedBrandFrames(await getBrandFrameProgress(userId, client))];
      if (!canUseProfileAppearance(appearance, level, current, owned)) throw new ProfileImageError(lockedBrandFrameMessage(appearance.frame) ?? 'Это оформление пока закрыто. Повысьте уровень профиля.');
    }
    if (appearance) await client.query('update "user" set "profileAppearance" = $2::jsonb where id = $1', [userId, JSON.stringify(appearance)]);
    if (layout) await client.query('update "user" set "profileLayout" = $2::jsonb where id = $1', [userId, JSON.stringify(layout)]);
    const user = await client.query(`update "user" set username = $2, name = $3, "telegramChannel" = $4, "telegramUsername" = $5, "updatedAt" = now() where id = $1 returning id`, [userId, input.username, input.name, input.telegramChannel, input.telegramUsername]);
    if (!user.rowCount) throw new Error('Profile not found');
    if (input.bio !== undefined) await client.query('update "user" set bio = $2 where id = $1', [userId, input.bio]);
    for (const kind of ['avatar', 'banner'] as const) {
      const data = images[kind];
      if (data === undefined) continue;
      if (data === null) await client.query('delete from "profileImage" where "userId" = $1 and kind = $2', [userId, kind]);
      else await client.query(`insert into "profileImage" ("userId", kind, data) values ($1, $2, $3)
        on conflict ("userId", kind) do update set id = gen_random_uuid(), data = excluded.data, "updatedAt" = now()`, [userId, kind, data]);
    }
    await client.query('commit');
  } catch (error) { await client.query('rollback'); throw error; }
  finally { client.release(); }
}
