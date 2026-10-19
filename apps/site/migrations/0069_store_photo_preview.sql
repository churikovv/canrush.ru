-- Mid-size store photo (up to 960 px) for list cards and the store mosaic: the 320 px thumbnail looked soft
-- when stretched. Filled on first request from the stored original, so older photos need no backfill.
alter table "storePhoto" add column preview bytea;
