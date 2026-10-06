'use server';
import { revalidatePath } from 'next/cache';
import { requireSiteAdmin } from '@/lib/admin';
import { campaignInput } from '@/lib/campaign-fields';
import { createCampaign } from '@/lib/campaigns';
export async function createCampaignAction(_state: {error?:string;success?:string}, form: FormData): Promise<{error?:string;success?:string}> {
  await requireSiteAdmin();
  let input;
  try { input=campaignInput(Object.fromEntries(form)); } catch(error) { return {error:error instanceof Error ? error.message : 'Проверьте поля.'}; }
  try { await createCampaign(input); } catch { return {error:'Не удалось создать кампанию. Попробуйте снова.'}; }
  revalidatePath('/admin');
  return {success:'Кампания создана. Скопируйте ссылку в списке ниже.'};
}
