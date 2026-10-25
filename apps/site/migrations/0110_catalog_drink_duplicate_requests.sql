-- A member may send a drink another member already added or sent, after a warning: their can may be another version
-- (new design, juice, sweetener), and the moderator renames or merges it. So one identity is unique only among
-- published drinks — two published under it would hide one another in the catalog — and a member still cannot send
-- the same drink twice while the first request waits.
drop index if exists catalog_drink_identity;
create unique index catalog_drink_identity on "catalogDrink"(lower(brand), lower(flavor)) where status = 'published';
create unique index catalog_drink_owner_pending on "catalogDrink"("ownerId", lower(brand), lower(flavor)) where status = 'pending';
