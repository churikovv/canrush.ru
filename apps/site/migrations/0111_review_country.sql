-- The country the reviewed can was made in (ISO 3166-1 alpha-2, the list is src/lib/countries.ts). Optional: older
-- reviews and members who do not know keep null.
alter table "review" add column "country" text check ("country" ~ '^[A-Z]{2}$');
