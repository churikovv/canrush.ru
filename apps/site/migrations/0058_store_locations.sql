-- Store point comes from the address: coordinates are optional (geocoded in the browser or set by hand).
alter table "marketStore"
  alter column latitude drop not null,
  alter column longitude drop not null,
  add column "locationSource" text check ("locationSource" in ('manual','geocoded'));
update "marketStore" set "locationSource"='manual' where latitude is not null and "locationSource" is null;
alter table "marketStore" add constraint market_store_location check (
  (latitude is null) = (longitude is null) and (latitude is null) = ("locationSource" is null)
);
