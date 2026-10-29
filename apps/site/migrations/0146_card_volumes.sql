-- Volumes a catalog card is known to come in besides those shops sell: a member's request for the same drink in
-- another can (330 ml next to 450 ml) is merged into the card and leaves its volumes here instead of being refused.
-- Shown on the drink's page; applied with the other card edits (`withCardEdits`).
alter table "catalogCardEdit" add column volumes integer[] not null default '{}'
  check (cardinality(volumes) <= 12 and 100 <= all(volumes) and 2000 >= all(volumes));
