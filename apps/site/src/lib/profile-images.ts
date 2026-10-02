import sharp from 'sharp';
import { getPool } from '@/db/pool';
import type { ProfileInput } from '@/lib/profile-fields';

export const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;
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
    if (file.size > MAX_PROFILE_IMAGE_BYTES) throw new ProfileImageError('Каждое изображение должно быть не больше 5 МБ.');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new ProfileImageError('Используйте JPG, PNG или WebP.');
    try {
      const bytes = Buffer.from(await file.arrayBuffer());
      const options = { limitInputPixels: 40_000_000, failOn: 'warning' as const };
      const metadata = await sharp(bytes, options).metadata();
      if (!['jpeg', 'png', 'webp'].includes(metadata.format ?? '') || (metadata.pages ?? 1) > 1) throw new Error('Invalid format');
      // Normalize EXIF orientation before applying browser coordinates.
      const oriented = metadata.autoOrient;
      let image = sharp(bytes, options).autoOrient();
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
      const data = await (kind === 'avatar' ? image.resize(512, 512, { fit: 'cover' }) : image.resize({ width: 1920, height: 1080, fit: 'inside', withoutEnlargement: true }))
        .webp({ quality: 82 }).toBuffer();
      if (data.length > 2 * 1024 * 1024) throw new Error('Output too large');
      images[kind] = data;
    } catch {
      throw new ProfileImageError('Не удалось прочитать изображение. Выберите статичный JPG, PNG или WebP до 40 мегапикселей.');
    }
  }
  return images;
}

export async function saveProfileCustomization(userId: string, input: ProfileInput, images: ProfileImageChanges) {
  const client = await getPool().connect();
  try {
    await client.query('begin');
    const user = await client.query(`update "user" set username = $2, name = $3, "telegramChannel" = $4, "updatedAt" = now() where id = $1 returning id`, [userId, input.username, input.name, input.telegramChannel]);
    if (!user.rowCount) throw new Error('Profile not found');
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
