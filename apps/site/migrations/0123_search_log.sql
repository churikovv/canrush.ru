-- What people search for: one row per search (first page of results in the catalog, stores or market), anonymous —
-- no member, session or address, only the normalised text, where it was searched, how many results and which brands
-- were in them. Business cabinets read it as «Поиск»: searches showing or naming their brands.
create table "searchQuery" (
  id bigserial primary key,
  query text not null check (char_length(query) between 2 and 80),
  scope text not null check (scope in ('catalog', 'stores', 'market')),
  results integer not null check (results >= 0),
  brands text[] not null default '{}',
  "createdAt" timestamptz not null default now()
);
create index search_query_created on "searchQuery"("createdAt");
create index search_query_brands on "searchQuery" using gin (brands);
