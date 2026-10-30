'use server';
import { revalidatePath } from 'next/cache';
import { requireFullAdmin } from '@/lib/admin';
import { sendBroadcast, sendTestBroadcast } from '@/lib/push-broadcast';
import { parseBroadcast } from '@/lib/push-broadcast-fields';

export interface BroadcastState { error?: string; success?: string }

const devices = (count: number) => { const a = count % 10, b = count % 100; return `${count} ${a === 1 && b !== 11 ? 'устройство' : a >= 2 && a <= 4 && (b < 12 || b > 14) ? 'устройства' : 'устройств'}`; };

export async function sendBroadcastAction(_state: BroadcastState, form: FormData): Promise<BroadcastState> {
  const admin = await requireFullAdmin();
  try {
    const input = parseBroadcast(Object.fromEntries(form));
    const test = form.get('intent') === 'test';
    const count = test ? await sendTestBroadcast(input, admin) : await sendBroadcast(input, admin.email);
    revalidatePath('/admin/push');
    return { success: test ? `Тест ушёл на ${devices(count)}.` : `Рассылка поставлена в очередь: ${devices(count)}.` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Не удалось отправить. Попробуйте снова.' };
  }
}
