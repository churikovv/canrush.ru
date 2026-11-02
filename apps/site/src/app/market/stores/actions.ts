'use server';
import { isFrozenError } from '@/lib/moderation';
import { prepareReviewPhotos, ReviewPhotoError } from '@/lib/review-photos';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { isSiteStaffEmail, requireSiteAdmin } from '@/lib/admin';
import { parseStore, StoreError } from '@/lib/store-fields';
import { deleteStoreAsTeam, getStore, moderateStore, returnStoreToDraft, saveStore } from '@/lib/stores';
import { getPool } from '@/db/pool';
import { linkStoreCatalog } from '@/lib/store-catalog';
import { geocodeStoreAddress, type StoreGeocode } from '@/lib/store-geocoder';
import { scanStorePhotos, type ScannedDrinks } from '@/lib/store-photo-drinks';
import { STORE_SCAN_PHOTOS } from '@/lib/store-photo-fields';
import { deleteStorePreset, listPublicStorePresets, listStorePresets, readyStorePresets, saveStorePreset, searchStoresToCopy, storeAssortment } from '@/lib/store-assortment';
import type { StoreClipboard } from '@/lib/store-clipboard';
import type { CopyStoreOption, StoreTemplates } from '@/lib/store-preset-fields';
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
async function takeDown(run:(adminId:string,adminEmail:string,note:string)=>Promise<void>,form:FormData,failed:string):Promise<StoreState>{
  const admin=await requireSiteAdmin();
  try{await run(admin.userId,admin.email,String(form.get('note')??''));revalidatePath('/market/stores','layout');revalidatePath('/admin/stores');return {saved:true};}
  catch(error){return {error:error instanceof StoreError?error.message:failed};}
}
export async function returnStoreAction(id:string,version:string,_previous:StoreState,form:FormData):Promise<StoreState>{
  return takeDown((adminId,adminEmail,note)=>returnStoreToDraft(adminId,adminEmail,id,note,version),form,'Не удалось вернуть магазин.');
}
export async function deleteStoreAction(id:string,version:string,_previous:StoreState,form:FormData):Promise<StoreState>{
  return takeDown((adminId,adminEmail,note)=>deleteStoreAsTeam(adminId,adminEmail,id,note,version),form,'Не удалось удалить магазин.');
}
const currentUser=async()=>(await auth.api.getSession({headers:await headers()}))?.user??null;
const currentUserId=async()=>(await currentUser())?.id??null;
/** Поле «Скопировать из магазина»: только для вошедших, ассортимент отдаёт сервер, цены — только у своих магазинов. */
export async function searchCopyStoresAction(query:string,city:string,exceptId:string|null):Promise<CopyStoreOption[]>{
  const userId=await currentUserId();
  return userId?searchStoresToCopy(userId,String(query),String(city),exceptId):[];
}
export async function storeAssortmentAction(id:string):Promise<StoreClipboard|null>{
  const userId=await currentUserId();
  return userId?storeAssortment(userId,String(id)):null;
}
const templatesOf=async(user:{id:string;email:string}):Promise<StoreTemplates>=>{
  const [ready,shared,own,staff]=await Promise.all([readyStorePresets(),listPublicStorePresets(user.id),listStorePresets(user.id),isSiteStaffEmail(user.email)]);
  return {ready,shared,own,staff};
};
export async function storeTemplatesAction():Promise<StoreTemplates|null>{
  const user=await currentUser();
  return user?templatesOf(user):null;
}
export async function saveStorePresetAction(id:string|null,name:string,drinks:unknown,publish:boolean):Promise<StoreTemplates|{error:string}>{
  const user=await currentUser();
  if(!user)return {error:'Войдите, чтобы сохранить шаблон.'};
  try{await saveStorePreset(user.id,String(name),drinks,publish===true,id===null?null:String(id));return await templatesOf(user);}
  catch(error){return {error:error instanceof StoreError||isFrozenError(error)?error.message:'Не удалось сохранить шаблон.'};}
}
export async function deleteStorePresetAction(id:string):Promise<StoreTemplates|{error:string}>{
  const user=await currentUser();
  if(!user)return {error:'Войдите, чтобы удалить шаблон.'};
  await deleteStorePreset(user.id,String(id));
  return templatesOf(user);
}
const scanCalls=new Map<string,number[]>();
const HOUR=3_600_000;
/** Напитки с фото: только для вошедших и не чаще 6 раз в час на аккаунт, каждый проход платный. Сбой не мешает заполнить список вручную. */
export async function scanStorePhotosAction(form:FormData):Promise<ScannedDrinks|{error:'auth'|'limit'|'off'|'failed'}>{
  const session=await auth.api.getSession({headers:await headers()});
  if(!session)return {error:'auth'};
  const now=Date.now(),recent=(scanCalls.get(session.user.id)??[]).filter(at=>at>now-HOUR);
  if(recent.length>=6)return {error:'limit'};
  scanCalls.set(session.user.id,[...recent,now]);
  if(scanCalls.size>5000)for(const [user,calls] of scanCalls)if(!calls.some(at=>at>now-HOUR))scanCalls.delete(user);
  try{
    const files=form.getAll('photos').filter((item):item is File=>item instanceof File).slice(0,STORE_SCAN_PHOTOS);
    const result=await scanStorePhotos(await Promise.all(files.map(async file=>Buffer.from(await file.arrayBuffer()))));
    return result??{error:'off'};
  }catch{return {error:'failed'};}
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
