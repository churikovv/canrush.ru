-- A company profile like a brand's page: a wide banner over the logo, members who subscribe to the company and a
-- notification to them when it publishes (news or a presentation). A banner is a new row per upload, like the logo.
create table "businessBanner" (
  id uuid primary key default gen_random_uuid(),
  "businessId" uuid not null references business(id) on delete cascade,
  data bytea not null check (octet_length(data) between 1 and 1048576),
  "createdAt" timestamptz not null default now()
);
alter table "businessBanner" alter column data set storage external;
alter table business add column "bannerId" uuid references "businessBanner"(id) on delete set null;

create table "businessFollow" (
  "businessId" uuid not null references business(id) on delete cascade,
  "userId" text not null references "user"(id) on delete cascade,
  "createdAt" timestamptz not null default now(),
  primary key ("businessId", "userId")
);
create index business_follow_user on "businessFollow"("userId");

alter table notification drop constraint notification_kind_check;
alter table notification add constraint notification_kind_check
  check (kind in ('follow','like','review-comment','wall-comment','price','monthly-top','comment-reply','mention','overtaken','drink-merged','business-invite','business-review','business-reply','support-reply','company-post'));

-- A new post of an approved company reaches its subscribers (not the author); off in the notification settings.
create function notify_company_post() returns trigger language plpgsql as $$
begin
  insert into notification("userId", "actorId", kind, "eventKey", payload)
  select f."userId", null, 'company-post', 'company-post:' || new.id,
    jsonb_build_object('businessId', b.id, 'business', b.name, 'text', left(new.text, 160), 'file', new."fileName")
  from "businessFollow" f join business b on b.id = f."businessId"
  where f."businessId" = new."businessId" and b.status = 'approved' and f."userId" is distinct from new."authorId"
  on conflict ("userId", "eventKey") do nothing;
  return null;
end $$;
create trigger business_post_notify after insert on "businessPost" for each row execute function notify_company_post();

alter table "notificationPreference" drop constraint "notificationPreference_kind_check";
alter table "notificationPreference" add constraint "notificationPreference_kind_check"
  check (kind in ('follow','like','review-comment','wall-comment','price','comment-reply','mention','overtaken','business-review','business-reply','company-post'));
