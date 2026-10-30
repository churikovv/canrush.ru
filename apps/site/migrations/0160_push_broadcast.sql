-- Рассылки push из админки. Адресаты разложены в ту же очередь `pushOutbox` строками на устройство, а текст лежит в
-- payload. Счётчик `delivered` растит отправитель: строки очереди живут 30 дней, история рассылок — дольше.
create table "pushBroadcast" (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 60),
  body text not null check (char_length(body) between 1 and 180),
  path text not null check (path ~ '^/([^/\\]|$)' and char_length(path) <= 200),
  audience text not null check (audience in ('all', 'android', 'ios', 'self')),
  recipients integer not null default 0,
  delivered integer not null default 0,
  "adminEmail" text not null,
  "createdAt" timestamptz not null default now()
);
create index "pushBroadcast_recent" on "pushBroadcast" ("createdAt" desc);

alter table "pushOutbox" drop constraint "pushOutbox_kind_check";
alter table "pushOutbox" add constraint "pushOutbox_kind_check" check (kind in ('notification', 'market', 'broadcast'));

-- Рассылки — не событие в аккаунте, а новости сервиса: участник отключает их отдельным переключателем.
alter table "user" add column "pushAnnouncements" boolean not null default true;
