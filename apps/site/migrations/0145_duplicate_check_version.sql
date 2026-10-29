-- Re-checking without repeating everything: `version` — the duplicate check's algorithm a row was written by (the code
-- re-checks «new» and «failed» rows of an older one, as when shop names, photos and the mix rule came); `inputs` — what
-- the model saw of a parser card (its shop names, cover and whether it is in shops), so a card is checked again when
-- that changes. Rows written before this migration count as version 1.
alter table "catalogCardCheck" add column version int not null default 1, add column inputs text;
alter table "catalogDrinkCheck" add column version int not null default 1;
