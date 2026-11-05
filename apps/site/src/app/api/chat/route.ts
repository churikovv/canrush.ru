import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ChatError, loadChat } from '@/lib/community-chat';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

/**
 * The open chat panel's polling: the newest page, who is in the chat and what the viewer may do. A GET and not a server
 * action, because Next runs server actions one after another — a poll every few seconds would hold up sending a
 * message, a reaction and every other action on the page.
 */
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    return NextResponse.json(await loadChat(session?.user.id ?? null), { headers: NO_STORE });
  } catch (error) {
    const message = error instanceof ChatError ? error.message : 'Не удалось загрузить чат. Проверьте интернет — сообщения обновятся сами.';
    return NextResponse.json({ error: message }, { status: error instanceof ChatError ? 400 : 503, headers: NO_STORE });
  }
}
