-- The feed merges every wall into one timeline ordered like a single wall.
create index "profileComment_feed_idx" on "profileComment" ("createdAt" desc, "id" desc);
create index "profileComment_author_idx" on "profileComment" ("userId", "createdAt" desc, "id" desc);
