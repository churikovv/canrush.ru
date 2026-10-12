'use server';
import { prepareReviewPhotos, ReviewPhotoError } from '@/lib/review-photos';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { requireSiteAdmin } from '@/lib/admin';
import { parseStore, StoreError } from '@/lib/store-fields';
import { saveStore, moderateStore } from '@/lib/stores';
export interface StoreState { error?: string; saved?: boolean }
export async function saveStoreAction(id: string | undefined, _previous: StoreState, form: FormData): Promise<StoreState> {
  const session=await auth.api.getSession({headers:await headers()});
  if(!session)return {error:'Войдите в аккаунт, чтобы добавить магазин.'};
  try{const input=parseStore(form);const photos=await prepareReviewPhotos(form);await saveStore(session.user.id,input,id,photos);revalidatePath('/market/stores','layout');revalidatePath('/admin/stores');return {saved:true};}
  catch(error){return {error:error instanceof StoreError || error instanceof ReviewPhotoError ? error.message:'Не удалось сохранить магазин. Попробуйте ещё раз.'};}
}
export async function moderateStoreAction(id:string,version:string,_previous:StoreState,form:FormData):Promise<StoreState>{
  const admin=await requireSiteAdmin();
  try{await moderateStore(admin.userId,id,String(form.get('status')) as 'published'|'rejected',String(form.get('note')??''),version);revalidatePath('/market/stores','layout');revalidatePath('/admin/stores');return {saved:true};}
  catch(error){return {error:error instanceof StoreError?error.message:'Не удалось проверить заявку.'};}
}
