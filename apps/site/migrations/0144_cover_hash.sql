-- Fingerprints of catalog covers for the duplicate check: a 64-bit difference hash (dHash) of each cover, so twins
-- with the same can photo are found without the model and without hashing every photo again. Keyed by the cover's
-- address, which changes with the photo (versioned addresses, content-named files).
create table "coverHash" (
  cover text primary key,
  hash text not null check (hash ~ '^[0-9a-f]{16}$'),
  "computedAt" timestamptz not null default now()
);
