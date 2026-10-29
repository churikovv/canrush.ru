-- The company's main presentation, laid open page after page in its own block on the profile: a PDF post of its wall
-- the team pinned. Without a pin the block shows the newest PDF; deleting the post unpins it.
alter table business add column "presentationId" uuid references "businessPost"(id) on delete set null;
