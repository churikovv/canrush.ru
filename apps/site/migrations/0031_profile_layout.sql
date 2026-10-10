alter table "user" add column "profileLayout" jsonb not null default '{"order":["experience","ratings","listings","wall","social","about"],"hidden":[]}';
