import type { AdapterRunResult } from '@canrush/shared';
import axios from 'axios';

/**
 * Уведомляет о проблемном источнике: всегда пишет в консоль, и опционально
 * отправляет сообщение в Telegram, если заданы TG_BOT_TOKEN и TG_CHAT_ID.
 */
export async function notifySourceIssue(result: AdapterRunResult): Promise<void> {
  const prefix = result.status === 'blocked' ? '🚫 BLOCKED' : result.status === 'stale' ? '⚠️ STALE' : '❗ ERROR';
  const message = `[canrush-parser] ${prefix}: ${result.source} — ${result.error ?? 'причина не указана'}`;
  console.warn(message);

  const token = process.env.TG_BOT_TOKEN;
  const chatId = process.env.TG_CHAT_ID;
  if (!token || !chatId) return;

  try {
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text: message,
    });
  } catch (err) {
    console.warn('[canrush-parser] не удалось отправить уведомление в Telegram:', (err as Error).message);
  }
}

