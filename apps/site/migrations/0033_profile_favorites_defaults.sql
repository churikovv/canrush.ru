update "user" set "profileLayout" = jsonb_set(jsonb_set("profileLayout", '{order}', ("profileLayout"->'order') || '["favorites"]'::jsonb), '{hidden}', ("profileLayout"->'hidden') || '["favorites"]'::jsonb)
where not ("profileLayout"->'order' ? 'favorites');
update "user" u set "profileLayout" = jsonb_set("profileLayout", '{hidden}', ("profileLayout"->'hidden') || '["listings"]'::jsonb)
where not ("profileLayout"->'hidden' ? 'listings') and not exists(select 1 from "marketListing" where "sellerId"=u.id);
alter table "user" alter column "profileLayout" set default '{"order":["experience","ratings","listings","wall","social","about","favorites"],"hidden":["favorites","listings"]}';
