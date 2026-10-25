'use server';
import { isFrozenError } from '@/lib/moderation';
import { prepareReviewPhotos, ReviewPhotoError } from '@/lib/review-photos';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { isSiteStaffEmail, requireSiteAdmin } from '@/lib/admin';
import { parseStore, StoreError } from '@/lib/store-fields';
import { getStore, saveStore, moderateStore } from '@/lib/stores';
import { getPool } from '@/db/pool';
import { linkStoreCatalog } from '@/lib/store-catalog';
import { geocodeStoreAddress, type StoreGeocode } from '@/lib/store-geocoder';
/** `staff` — saved by an admin or moderator editing someone else's store: it stays published, nothing goes to review. */
export interface StoreState { error?: string; saved?: boolean; staff?: boolean }
export async function saveStoreAction(id: string | undefined, _previous: StoreState, form: FormData): Promise<StoreState> {
  const session=await auth.api.getSession({headers:await headers()});
  if(!session)return {error:'Войдите в аккаунт, чтобы добавить магазин.'};
  try{
    const parsed=parseStore(form);const input={...parsed,catalog:await linkStoreCatalog(parsed.catalog)};const photos=await prepareReviewPhotos(form);
    // Someone else's store, edited by the team from /admin/stores: kept as it is, written to the audit log.
    const owner=id?(await getStore(id))?.ownerId:undefined;
    const staff=Boolean(id&&owner&&owner!==session.user.id&&await isSiteStaffEmail(session.user.email));
    await saveStore(session.user.id,input,id,photos,staff);
    if(staff&&id)await getPool().query('insert into "adminAuditLog" ("adminEmail", action, "targetType", "targetId") values ($1, \'edit\', \'store\', $2)',[session.user.email.toLowerCase(),id]);
    revalidatePath('/market/stores','layout');revalidatePath('/admin/stores');return {saved:true,staff};}
  catch(error){return {error:error instanceof StoreError || error instanceof ReviewPhotoError || isFrozenError(error) ? error.message:'Не удалось сохранить магазин. Попробуйте ещё раз.'};}
}
export async function moderateStoreAction(id:string,version:string,_previous:StoreState,form:FormData):Promise<StoreState>{
  const admin=await requireSiteAdmin();
  try{await moderateStore(admin.userId,id,String(form.get('status')) as 'published'|'rejected',String(form.get('note')??''),version);revalidatePath('/market/stores','layout');revalidatePath('/admin/stores');return {saved:true};}
  catch(error){return {error:error instanceof StoreError?error.message:'Не удалось проверить заявку.'};}
}
const geocodeCalls=new Map<string,number[]>();
/** Address lookup for the store form; signed-in only and at most 20 lookups a minute per account. */
export async function geocodeStoreAction(city:string,address:string):Promise<{result:StoreGeocode|null}|{error:'auth'|'limit'|'failed'}>{
  const session=await auth.api.getSession({headers:await headers()});
  if(!session)return {error:'auth'};
  const now=Date.now(),recent=(geocodeCalls.get(session.user.id)??[]).filter(at=>at>now-60_000);
  if(recent.length>=20)return {error:'limit'};
  geocodeCalls.set(session.user.id,[...recent,now]);
  if(geocodeCalls.size>5000)for(const [user,calls] of geocodeCalls)if(!calls.some(at=>at>now-60_000))geocodeCalls.delete(user);
  try{return {result:await geocodeStoreAddress(String(city),String(address))};}catch{return {error:'failed'};}
}
