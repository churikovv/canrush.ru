-- A drink added from the cabinet of an approved company is published at once, without the moderation queue; the
-- company is kept on the row so the admin list shows where it came from. Staff still edit, merge and delete it.
alter table "catalogDrink" add column "businessId" uuid references business(id) on delete set null;
