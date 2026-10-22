-- Закладки: участник сохраняет записи стены/ленты (иконка-закладка), список — вкладка «Сохранённые» в ленте.
-- Видны только владельцу закладок; удаляются вместе с записью или аккаунтом.
create table "savedPost" (
  "userId" text not null references "user"(id) on delete cascade,
  "postId" uuid not null references "profileComment"(id) on delete cascade,
  "createdAt" timestamptz not null default now(),
  primary key ("userId", "postId")
);
create index "savedPost_recent" on "savedPost" ("userId", "createdAt" desc);
