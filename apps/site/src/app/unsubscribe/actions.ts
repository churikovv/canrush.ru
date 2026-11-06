'use server';
import { redirect } from 'next/navigation';
import { unsubscribeComeback } from '@/lib/comeback-email';

/** Кнопка страницы отписки: подпись из ссылки письма проверяется, вход не нужен. */
export async function unsubscribeAction(form: FormData) {
  const done = await unsubscribeComeback(form.get('u'), form.get('t'));
  redirect(done ? '/unsubscribe?done=1' : '/unsubscribe?error=1');
}
