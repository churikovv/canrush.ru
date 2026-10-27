-- A company's public reply to a review of one of its approved drinks: one per review, written by the owner or an
-- active member of an approved company. Deleting the review or the company removes it.
create table "reviewCompanyReply" (
  "reviewId" uuid primary key references review(id) on delete cascade,
  "businessId" uuid not null references business(id) on delete cascade,
  "authorId" text references "user"(id) on delete set null,
  text text not null check (char_length(text) between 1 and 1000),
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create index review_company_reply_business on "reviewCompanyReply"("businessId");

-- The review's author hears about the reply (`business-reply`, can be switched off); not when they are on the
-- company's team themselves.
alter table notification drop constraint notification_kind_check;
alter table notification add constraint notification_kind_check
  check (kind in ('follow','like','review-comment','wall-comment','price','monthly-top','comment-reply','mention','overtaken','drink-merged','business-invite','business-review','business-reply'));
alter table "notificationPreference" drop constraint "notificationPreference_kind_check";
alter table "notificationPreference" add constraint "notificationPreference_kind_check"
  check (kind in ('follow','like','review-comment','wall-comment','price','comment-reply','mention','overtaken','business-review','business-reply'));

create function notify_business_reply() returns trigger language plpgsql as $$
begin
  insert into notification("userId", "actorId", kind, "eventKey", "reviewId", payload)
  select r."userId", new."authorId", 'business-reply', 'business-reply:' || new."reviewId", r.id,
    jsonb_build_object('brand', r.brand, 'flavor', r.flavor, 'business', b.name, 'text', left(new.text, 160))
  from review r join business b on b.id = new."businessId"
  where r.id = new."reviewId" and r."userId" <> coalesce(new."authorId", '')
    and r."userId" <> b."ownerId"
    and not exists(select 1 from "businessMember" m where m."businessId" = b.id and m."userId" = r."userId" and m.status = 'active')
  on conflict ("userId", "eventKey") do nothing;
  return null;
exception when foreign_key_violation then return null;
end $$;
create trigger review_company_reply_notify after insert on "reviewCompanyReply" for each row execute function notify_business_reply();
