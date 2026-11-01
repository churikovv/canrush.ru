'use client';
import { useActionState, useEffect, useRef } from 'react';
import { sendBotMessageAction } from '@/app/admin/bot/actions';
import { FormAlert } from '@/components/form-alert';
import { BOT_MESSAGE_LIMIT } from '@/lib/bot-message-limits';

/** The team's message to one member: it goes out through the bot, the answer comes back into the same dialog. */
export function AdminBotForm({ userId, disabled }: { userId: string; disabled: boolean }) {
  const [state, action, pending] = useActionState(sendBotMessageAction, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.sent) form.current?.reset(); }, [state.sent]);
  return <form ref={form} className="bot-dialog-form" action={action}>
    <input type="hidden" name="userId" value={userId} />
    {state.error && <FormAlert tone="error">{state.error}</FormAlert>}
    <textarea name="text" rows={4} maxLength={BOT_MESSAGE_LIMIT} required disabled={disabled} aria-label="Сообщение" placeholder="Сообщение от команды CanRush" />
    <button type="submit" className="bc-button" disabled={pending || disabled}>{pending ? 'Отправляем…' : 'Отправить в бота'}</button>
  </form>;
}
