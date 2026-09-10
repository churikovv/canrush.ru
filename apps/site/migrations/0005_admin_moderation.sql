create table "siteAdmin" (
  "email" text primary key check ("email" = lower("email") and char_length("email") between 3 and 320),
  "isOwner" boolean not null default false,
  "addedByUserId" text references "user" ("id") on delete set null,
  "createdAt" timestamptz default current_timestamp not null
);

create unique index "siteAdmin_single_owner_uidx" on "siteAdmin" (("isOwner")) where "isOwner";

insert into "siteAdmin" ("email", "isOwner")
values ('sobik.steam@yandex.ru', true);

create table "userBlock" (
  "userId" text primary key references "user" ("id") on delete cascade,
  "blockedByUserId" text references "user" ("id") on delete set null,
  "createdAt" timestamptz default current_timestamp not null
);

create index "userBlock_createdAt_idx" on "userBlock" ("createdAt" desc);

create table "adminAuditLog" (
  "id" bigint generated always as identity primary key,
  "adminEmail" text not null,
  "action" text not null,
  "targetType" text not null,
  "targetId" text not null,
  "createdAt" timestamptz default current_timestamp not null
);

create index "adminAuditLog_createdAt_idx" on "adminAuditLog" ("createdAt" desc);

create or replace function prevent_blocked_contribution()
returns trigger
language plpgsql
as $$
begin
  if exists (select 1 from "userBlock" where "userId" = new."userId") then
    raise exception 'blocked users cannot create or update public contributions'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger "review_prevent_blocked_contribution"
before insert or update on "review"
for each row execute function prevent_blocked_contribution();

create trigger "tierList_prevent_blocked_contribution"
before insert or update on "tierList"
for each row execute function prevent_blocked_contribution();
