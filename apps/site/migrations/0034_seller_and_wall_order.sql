alter table "user" drop constraint "user_known_profile_tag";
alter table "user" add constraint "user_known_profile_tag" check (
  "profileTags" <@ array['burner','adrenaline','six-seven','collector','first-review','admin','friend','critic','deadinside','explorer','three','kitty','telegram','altushka','flash','seller']::text[]
);
create trigger seller_achievement_experience
  after insert on "profileAchievement" for each row
  when (new.key = 'seller') execute function product_achievement_experience();

create function market_seller_achievement() returns trigger language plpgsql as $$
begin
  insert into "profileAchievement" ("userId", key) values (new."sellerId", 'seller') on conflict do nothing;
  return new;
end $$;
create trigger market_seller_achievement after insert on "marketListing"
  for each row execute function market_seller_achievement();
insert into "profileAchievement" ("userId", key)
  select distinct "sellerId", 'seller' from "marketListing" on conflict do nothing;

update "user" set "profileLayout" = jsonb_set("profileLayout", '{order}', '["experience","ratings","listings","social","favorites","about","wall"]')
where "profileLayout"->'order' in (
  '["experience","ratings","listings","wall","social","about","favorites"]'::jsonb,
  '["experience","ratings","listings","wall","social","favorites","about"]'::jsonb
);
alter table "user" alter column "profileLayout" set default '{"order":["experience","ratings","listings","social","favorites","about","wall"],"hidden":["favorites","listings"]}';
