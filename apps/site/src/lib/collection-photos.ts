import { getPool } from '@/db/pool';
import { CollectionPhotoError, MAX_COLLECTION_PHOTOS } from '@/lib/collection-photo-fields';
import { isContentId } from '@/lib/profile-report-fields';
import type { PreparedReviewPhoto } from '@/lib/review-photos';

export interface CollectionPhoto { id: string; caption: string | null }

/** A member's photos, newest first, and whether the viewer may delete them as staff (one InitPlan for the flag). */
export async function listCollectionPhotos(userId: string, viewerId: string | null): Promise<{ photos: CollectionPhoto[]; staff: boolean }> {
  const [photos, staff] = await Promise.all([
    getPool().query<CollectionPhoto>('select id, caption from "collectionPhoto" where "userId" = $1 order by "createdAt" desc, id desc limit $2', [userId, MAX_COLLECTION_PHOTOS]),
    viewerId ? getPool().query<{ staff: boolean }>('select exists(select 1 from "user" su join "siteAdmin" sa on lower(su.email) = sa.email where su.id = $1) as staff', [viewerId]) : null,
  ]);
  return { photos: photos.rows, staff: staff?.rows[0]?.staff === true };
}

/**
 * Adds photos to a member's collection under a lock on the member, so two tabs cannot pass the limit together. A blocked
 * member adds nothing; a frozen one is stopped by the table's trigger (CR002).
 */
export async function addCollectionPhotos(userId: string, photos: { photo: PreparedReviewPhoto; caption: string | null }[]) {
  if (!photos.length) throw new CollectionPhotoError('Выберите хотя бы одно фото.');
  const client = await getPool().connect();
  try {
    await client.query('begin');
    const member = await client.query<{ blocked: boolean; count: number }>(`select exists(select 1 from "userBlock" where "userId" = u.id) as blocked,
        (select count(*)::int from "collectionPhoto" where "userId" = u.id) as count from "user" u where u.id = $1 for no key update`, [userId]);
    const row = member.rows[0];
    if (!row || row.blocked) throw new CollectionPhotoError('Аккаунт заблокирован: добавлять фото нельзя.');
    if (row.count + photos.length > MAX_COLLECTION_PHOTOS) {
      throw new CollectionPhotoError(row.count >= MAX_COLLECTION_PHOTOS ? `В коллекции уже ${MAX_COLLECTION_PHOTOS} фото — удалите одно, чтобы добавить новое.` : `Поместится ещё ${MAX_COLLECTION_PHOTOS - row.count} фото.`);
    }
    for (const { photo, caption } of photos) {
      await client.query('insert into "collectionPhoto" ("userId", caption, data, thumbnail) values ($1, $2, $3, $4)', [userId, caption, photo.data, photo.thumbnail]);
    }
    await client.query('commit');
  } catch (error) { await client.query('rollback'); throw error; }
  finally { client.release(); }
}

/** Only the owner deletes a photo here; staff delete through `staffDeleteContent`. */
export async function deleteCollectionPhoto(userId: string, id: string): Promise<boolean> {
  if (!isContentId(id)) return false;
  return Boolean((await getPool().query('delete from "collectionPhoto" where id = $1 and "userId" = $2', [id, userId])).rowCount);
}

/** The picture or its thumbnail; a photo of a blocked member is not served, as the rest of their profile. */
export async function getCollectionPhotoFile(id: string, thumbnail: boolean): Promise<Buffer | null> {
  if (!isContentId(id)) return null;
  const result = await getPool().query<{ data: Buffer }>(`select ${thumbnail ? 'p.thumbnail' : 'p.data'} as data from "collectionPhoto" p
    where p.id = $1 and not exists(select 1 from "userBlock" b where b."userId" = p."userId")`, [id]);
  return result.rows[0]?.data ?? null;
}
