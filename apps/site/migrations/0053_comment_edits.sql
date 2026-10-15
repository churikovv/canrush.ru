-- Authors can edit wall records and discussion comments; the mark shows the text changed after publishing.
alter table "profileComment" add column "editedAt" timestamptz;
alter table "wallReply" add column "editedAt" timestamptz;
alter table "reviewComment" add column "editedAt" timestamptz;
alter table "tierListComment" add column "editedAt" timestamptz;
