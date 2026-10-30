/** Rules of an admin push broadcast, shared by the form and the server. */
export const BROADCAST_TITLE_LIMIT = 60;
export const BROADCAST_BODY_LIMIT = 180;
export const BROADCAST_PATH_LIMIT = 200;
/** Between two mass broadcasts: stops a double send and keeps people from getting a burst of pushes. */
export const BROADCAST_PAUSE_MINUTES = 5;

export const BROADCAST_AUDIENCES = ['all', 'android', 'ios'] as const;
export type BroadcastAudience = (typeof BROADCAST_AUDIENCES)[number];
export const AUDIENCE_LABELS: Record<BroadcastAudience | 'self', string> = { all: 'Все устройства', android: 'Android', ios: 'iPhone и iPad', self: 'Тест · только мне' };

export interface BroadcastInput { title: string; body: string; path: string; audience: BroadcastAudience }

const line = (value: unknown) => (typeof value === 'string' ? value : '').replace(/\s+/g, ' ').trim();

/** A path inside the site: a link to canrush.ru is accepted and cut down to its path, other sites are not. */
export function parseBroadcastPath(value: unknown): string {
  const raw = line(value) || '/';
  const path = raw.replace(/^https:\/\/(www\.)?canrush\.ru(?=\/|$)/i, '') || '/';
  if (path.length > BROADCAST_PATH_LIMIT || !/^\/(?![/\\])\S*$/.test(path)) throw new Error('Ссылка — страница этого сайта, например /gacha.');
  return path;
}

export function parseBroadcast(input: { title?: unknown; body?: unknown; path?: unknown; audience?: unknown }): BroadcastInput {
  const title = line(input.title);
  const body = line(input.body);
  if (!title) throw new Error('Напишите заголовок.');
  if (title.length > BROADCAST_TITLE_LIMIT) throw new Error(`Заголовок — до ${BROADCAST_TITLE_LIMIT} символов.`);
  if (!body) throw new Error('Напишите текст.');
  if (body.length > BROADCAST_BODY_LIMIT) throw new Error(`Текст — до ${BROADCAST_BODY_LIMIT} символов.`);
  const audience = BROADCAST_AUDIENCES.find(item => item === input.audience);
  if (!audience) throw new Error('Выберите, кому отправить.');
  return { title, body, path: parseBroadcastPath(input.path), audience };
}
