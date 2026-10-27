-- Business cabinet settings: the company logo, a team that manages the cabinet with the owner, and notifications about
-- new reviews of the company's drinks.

-- Logo: a new row per upload (the id is the cache key), the company points at the current one.
create table "businessLogo" (
  id uuid primary key default gen_random_uuid(),
  "businessId" uuid not null references business(id) on delete cascade,
  data bytea not null,
  "createdAt" timestamptz not null default now()
);
alter table "businessLogo" alter column data set storage external;
alter table business add column "logoId" uuid references "businessLogo"(id) on delete set null;

-- Team: the owner invites a member by nickname; the member accepts. One active membership per member.
create table "businessMember" (
  "businessId" uuid not null references business(id) on delete cascade,
  "userId" text not null references "user"(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'active')),
  "invitedBy" text references "user"(id) on delete set null,
  "createdAt" timestamptz not null default now(),
  "acceptedAt" timestamptz,
  primary key ("businessId", "userId")
);
create unique index business_member_one_active on "businessMember"("userId") where status = 'active';
create index business_member_user on "businessMember"("userId", status);

-- Two new notification kinds: an invitation to a team and a new review of a company's drink (it can be switched off).
alter table notification drop constraint notification_kind_check;
alter table notification add constraint notification_kind_check
  check (kind in ('follow','like','review-comment','wall-comment','price','monthly-top','comment-reply','mention','overtaken','drink-merged','business-invite','business-review'));
alter table "notificationPreference" drop constraint "notificationPreference_kind_check";
alter table "notificationPreference" add constraint "notificationPreference_kind_check"
  check (kind in ('follow','like','review-comment','wall-comment','price','comment-reply','mention','overtaken','business-review'));

-- A review of a drink an approved company has approved: its owner and active members hear about it (not the author,
-- not when the author is banned). The preference trigger drops it for those who switched it off; Telegram and push
-- mirror it like every notification.
create function notify_business_review() returns trigger language plpgsql as $$
begin
  if exists(select 1 from "userBlock" where "userId" = new."userId") then return null; end if;
  insert into notification("userId", "actorId", kind, "eventKey", "reviewId", payload)
  select distinct people."userId", new."userId", 'business-review', 'business-review:' || new.id, new.id,
    jsonb_build_object('brand', new.brand, 'flavor', new.flavor, 'business', b.name, 'taste', new.taste, 'design', new.design)
  from "businessDrink" d
  join business b on b.id = d."businessId" and b.status = 'approved'
  join lateral (select b."ownerId" as "userId" union select m."userId" from "businessMember" m where m."businessId" = b.id and m.status = 'active') people on true
  where d.brand = new.brand and d.flavor = new.flavor and d.status = 'approved' and people."userId" <> new."userId"
  on conflict ("userId", "eventKey") do nothing;
  return null;
exception when foreign_key_violation then return null;
end $$;
create trigger review_business_notify after insert on review for each row execute function notify_business_review();
