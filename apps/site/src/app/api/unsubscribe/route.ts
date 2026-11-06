import { NextResponse, type NextRequest } from 'next/server';
import { unsubscribeComeback } from '@/lib/comeback-email';
import { getAuthEnv } from '@/lib/env';

/**
 * Отписка в один клик (RFC 8058) из заголовка `List-Unsubscribe` письма «Что нового на CanRush»: почтовая программа
 * присылает POST на этот адрес с подписью в query. Ответ без тела страницы — его никто не видит.
 */
export async function POST(request: NextRequest) {
  const done = await unsubscribeComeback(request.nextUrl.searchParams.get('u'), request.nextUrl.searchParams.get('t'));
  return new NextResponse(done ? 'Unsubscribed' : 'Invalid link', { status: done ? 200 : 400, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' } });
}

/** Старые почтовые программы открывают адрес заголовка в браузере — там страница с кнопкой, а не отписка по GET. */
export function GET(request: NextRequest) {
  const page = new URL('/unsubscribe', getAuthEnv().authUrl);
  for (const name of ['u', 't']) {
    const value = request.nextUrl.searchParams.get(name);
    if (value) page.searchParams.set(name, value);
  }
  return NextResponse.redirect(page, { status: 303, headers: { 'Cache-Control': 'no-store' } });
}
