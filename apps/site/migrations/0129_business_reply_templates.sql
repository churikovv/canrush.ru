-- Saved replies of a company: the team picks one in the reply dialog and saves new ones from there. `{автор}` and
-- `{напиток}` in the text are filled in when a template is picked.
create table "businessReplyTemplate" (
  id uuid primary key default gen_random_uuid(),
  "businessId" uuid not null references business(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 40),
  text text not null check (char_length(text) between 1 and 1000),
  "createdBy" text references "user"(id) on delete set null,
  "createdAt" timestamptz not null default now(),
  unique ("businessId", title)
);
create index business_reply_template_business on "businessReplyTemplate"("businessId", "createdAt");
