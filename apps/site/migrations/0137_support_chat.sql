-- «Помощь»: a member's chat with the CanRush team. One thread per member (it reopens when they write again), its
-- messages, who read up to when on each side. A team reply notifies the member (`support-reply`, always on: it answers
-- their own question), and that notification goes to Telegram and push like any other.
create table "supportThread" (
  id uuid primary key default gen_random_uuid(),
  "userId" text not null unique references "user"(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'closed')),
  "lastMessageAt" timestamptz not null default now(),
  "lastFromStaff" boolean not null default false,
  "userReadAt" timestamptz,
  "staffReadAt" timestamptz,
  "createdAt" timestamptz not null default now()
);
create index support_thread_queue on "supportThread"(status, "lastMessageAt" desc);

create table "supportMessage" (
  id uuid primary key default gen_random_uuid(),
  "threadId" uuid not null references "supportThread"(id) on delete cascade,
  "senderId" text references "user"(id) on delete set null,
  "fromStaff" boolean not null,
  text text not null check (char_length(text) between 1 and 4000),
  "createdAt" timestamptz not null default now()
);
create index support_message_thread on "supportMessage"("threadId", "createdAt", id);

alter table notification drop constraint notification_kind_check;
alter table notification add constraint notification_kind_check
  check (kind in ('follow','like','review-comment','wall-comment','price','monthly-top','comment-reply','mention','overtaken','drink-merged','business-invite','business-review','business-reply','support-reply'));

create function notify_support_reply() returns trigger language plpgsql as $$
begin
  if not new."fromStaff" then return null; end if;
  insert into notification("userId", "actorId", kind, "eventKey", payload)
  select t."userId", null, 'support-reply', 'support-reply:' || new.id, jsonb_build_object('text', left(new.text, 160))
  from "supportThread" t where t.id = new."threadId"
  on conflict ("userId", "eventKey") do nothing;
  return null;
exception when foreign_key_violation then return null;
end $$;
create trigger support_message_notify after insert on "supportMessage" for each row execute function notify_support_reply();
