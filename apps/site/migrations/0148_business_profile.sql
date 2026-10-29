-- Public company profiles (/company/<id>): the logo as the avatar, the company's store on the CanRush map to go to, the
-- sections it shows (drinks, listings, presentations and the store are on unless the team hides them) and a wall of
-- posts where the team pins PDF presentations. Posts belong to the company; the author is who published it.
alter table business
  add column "storeId" uuid references "marketStore"(id) on delete set null,
  add column "profileHidden" text[] not null default '{}'
    check ("profileHidden" <@ array['store', 'presentations', 'drinks', 'listings']::text[]);

create table "businessPost" (
  id uuid primary key default gen_random_uuid(),
  "businessId" uuid not null references business(id) on delete cascade,
  "authorId" text references "user"(id) on delete set null,
  text text not null default '' check (char_length(text) <= 1000),
  "fileName" text check ("fileName" is null or char_length("fileName") between 1 and 120),
  file bytea,
  "fileSize" integer check ("fileSize" is null or "fileSize" between 1 and 20971520),
  "createdAt" timestamptz not null default now(),
  check ((file is null) = ("fileName" is null) and (file is null) = ("fileSize" is null)),
  check (text <> '' or file is not null)
);
alter table "businessPost" alter column file set storage external;
create index business_post_feed on "businessPost"("businessId", "createdAt" desc);
create trigger "businessPost_freeze" before insert on "businessPost" for each row execute function prevent_frozen_posting('authorId');

alter table "profileReport" drop constraint "profileReport_contentKind_check";
alter table "profileReport" add constraint "profileReport_contentKind_check" check ("contentKind" in (
  'review','review-comment','tier-list','tier-comment','wall-post','wall-reply','market-listing','market-message','store','story','article','business-post'
));
