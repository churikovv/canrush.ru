CREATE TABLE "profileCompatibilitySnapshot" (
 "userLow" text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 "userHigh" text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 day date NOT NULL DEFAULT (now() AT TIME ZONE 'Europe/Moscow')::date,
 score smallint NOT NULL CHECK (score BETWEEN 0 AND 100),
 criteria text NOT NULL,
 parts jsonb NOT NULL,
 PRIMARY KEY ("userLow", "userHigh", day),
 CHECK ("userLow" < "userHigh")
);
