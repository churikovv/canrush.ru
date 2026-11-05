-- Люди в колоде дейтинга (`people-suggestions.ts`): кого участник пропустил свайпом влево, того колода не предлагает
-- `SKIP_DAYS` дней. Подписка хранится как обычно, в "userFollow".
create table "followSuggestionSkip" (
  "userId" text not null references "user"(id) on delete cascade,
  "targetId" text not null references "user"(id) on delete cascade,
  "createdAt" timestamptz not null default now(),
  primary key ("userId", "targetId"),
  check ("userId" <> "targetId")
);
