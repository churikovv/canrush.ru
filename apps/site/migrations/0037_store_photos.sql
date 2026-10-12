CREATE TABLE "storePhoto" (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 "storeId" uuid NOT NULL REFERENCES "marketStore"(id) ON DELETE CASCADE,
 position integer NOT NULL CHECK (position BETWEEN 0 AND 4),
 data bytea NOT NULL CHECK (octet_length(data) <= 2097152),
 thumbnail bytea NOT NULL CHECK (octet_length(thumbnail) <= 262144)
);
CREATE INDEX "storePhoto_store_idx" ON "storePhoto"("storeId", position);
