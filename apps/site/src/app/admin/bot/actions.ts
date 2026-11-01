'use server';
import { revalidatePath } from 'next/cache';
import { requireFullAdmin } from '@/lib/admin';
import { BotMessageError, sendBotMessage } from '@/lib/bot-messages';

export interface BotSendState { error?: string; sent?: number }

/** «Отправить» in a dialog: `sent` changes on every message, so the form knows to clear itself. */
export async function sendBotMessageAction(_state: BotSendState, form: FormData): Promise<BotSendState> {
  const admin = await requireFullAdmin();
  try {
    await sendBotMessage(admin.email, String(form.get('userId') ?? ''), form.get('text'));
    revalidatePath('/admin/bot');
    return { sent: Date.now() };
  } catch (error) {
    if (error instanceof BotMessageError) return { error: error.message };
    console.error('bot message failed', error);
    return { error: 'Не удалось отправить. Попробуйте снова.' };
  }
}
