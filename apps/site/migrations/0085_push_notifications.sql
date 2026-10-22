-- Push-уведомления Android-приложения. Устройство — токен FCM или RuStore Push, привязанный к
-- вошедшему участнику; тот же токен после входа другим аккаунтом переходит к нему.
create table "pushDevice" (
  token text primary key check (char_length(token) between 16 and 4096),
  "userId" text not null references "user"(id) on delete cascade,
  provider text not null check (provider in ('fcm', 'rustore')),
  "createdAt" timestamptz not null default now(),
  "lastSeenAt" timestamptz not null default now()
);
create index "pushDevice_user" on "pushDevice" ("userId");

-- Очередь как у Telegram: вид + данные, текст рендерит отправитель; dedupeKey включает токен.
create table "pushOutbox" (
  id bigserial primary key,
  token text not null references "pushDevice"(token) on delete cascade,
  kind text not null check (kind in ('notification', 'market')),
  payload jsonb not null default '{}',
  "dedupeKey" text not null unique,
  "sendAfter" timestamptz not null default now(),
  attempts smallint not null default 0,
  "sentAt" timestamptz,
  "lastError" text,
  "createdAt" timestamptz not null default now()
);
create index "pushOutbox_pending" on "pushOutbox" ("sendAfter", id) where "sentAt" is null;

create function push_enqueue(p_user text, p_kind text, p_payload jsonb, p_dedupe text) returns void language sql as $$
  insert into "pushOutbox" (token, kind, payload, "dedupeKey")
  select d.token, p_kind, p_payload, p_dedupe || ':' || d.token
  from "pushDevice" d
  where d."userId" = p_user
  on conflict ("dedupeKey") do nothing
$$;

-- Уведомления сайта, прошедшие фильтр настроек, уходят и в push (как notification_telegram).
create function enqueue_push_notification() returns trigger language plpgsql as $$
begin
  perform push_enqueue(new."userId", 'notification', jsonb_build_object('notificationId', new.id), 'notification:' || new.id);
  return null;
end $$;
create trigger notification_push after insert on notification
  for each row execute function enqueue_push_notification();
