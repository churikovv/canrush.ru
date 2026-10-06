alter table "marketListing" add column quantity integer not null default 0 check (quantity between 0 and 100000);
alter table "marketOrder" add column quantity integer not null default 1 check (quantity between 1 and 100000);
alter table "marketOrder" add column "unitPrice" integer;
alter table "marketOrder" add column "stockReserved" boolean not null default false;
update "marketOrder" o set "unitPrice"=l.price from "marketListing" l where l.id=o."listingId";
alter table "marketOrder" alter column "unitPrice" set not null;
alter table "marketOrder" add constraint "marketOrder_unitPrice_check" check ("unitPrice" between 1 and 1000000000);
alter table "marketOrder" drop constraint "marketOrder_listingId_buyerId_key";
create unique index "marketOrder_active_buyer" on "marketOrder"("listingId","buyerId") where status in ('new','confirmed');
