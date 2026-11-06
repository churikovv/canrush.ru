-- «Премия за энергию»: ежегодное голосование участников по номинациям (/awards). Номинанты — лучшие напитки по оценкам
-- участников (`seeded`) и напитки каталога, которые участник добавил своим голосом (`addedBy`; удалённый аккаунт
-- оставляет номинанта, но не делает его выдвинутым по данным). Голос — один на номинацию,
-- его можно менять, пока голосование открыто. Правила и сроки — `src/lib/awards-fields.ts`, сервер — `awards.ts`.
create table "awardNominee" (
  award text not null,
  category text not null check (category in ('design', 'taste', 'drink', 'sugarfree')),
  brand text not null,
  flavor text not null,
  seeded boolean not null default false,
  "addedBy" text references "user"(id) on delete set null,
  "createdAt" timestamptz not null default now(),
  primary key (award, category, brand, flavor)
);

create table "awardVote" (
  award text not null,
  category text not null,
  "userId" text not null references "user"(id) on delete cascade,
  brand text not null,
  flavor text not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  primary key (award, category, "userId"),
  foreign key (award, category, brand, flavor) references "awardNominee" (award, category, brand, flavor) on delete cascade
);
create index award_vote_drink on "awardVote" (award, category, brand, flavor);

-- A drink merge (`move_drink_identity`) carries the award along with everything else.
create or replace function move_drink_identity(fb text, ff text, tb text, tf text) returns void language plpgsql as $$
declare r record;
begin
  perform set_config('canrush.identity_move', 'on', true);
  for r in select a.id as dup, b.id as kept from review a
    join review b on b.brand = tb and b.flavor = tf and b."userId" = a."userId"
    where a.brand = fb and a.flavor = ff
  loop
    update "reviewComment" set "reviewId" = r.kept where "reviewId" = r.dup;
    update "reviewReaction" x set "reviewId" = r.kept where x."reviewId" = r.dup
      and not exists(select 1 from "reviewReaction" y where y."reviewId" = r.kept and y."userId" = x."userId");
    update "reviewPhoto" ph set "reviewId" = r.kept, position = s.pos
      from (select id, (select coalesce(max(position) + 1, 0) from "reviewPhoto" where "reviewId" = r.kept)
          + (row_number() over (order by position))::int - 1 as pos
        from "reviewPhoto" where "reviewId" = r.dup) s
      where ph.id = s.id and s.pos <= 4;
    delete from review where id = r.dup;
  end loop;
  update review set brand = tb, flavor = tf where brand = fb and flavor = ff;

  -- A price watch points at its favourite: checked at commit, so the favourite and its watches can move one after the other.
  set constraints "favoritePriceWatch_userId_brand_flavor_fkey" deferred;
  delete from favorite a where a.brand = fb and a.flavor = ff
    and exists(select 1 from favorite b where b."userId" = a."userId" and b.brand = tb and b.flavor = tf);
  update favorite set brand = tb, flavor = tf where brand = fb and flavor = ff;

  delete from "favoritePriceWatch" a where a.brand = fb and a.flavor = ff
    and exists(select 1 from "favoritePriceWatch" b where b."userId" = a."userId" and b.brand = tb and b.flavor = tf and b.city = a.city and b.volume = a.volume);
  update "favoritePriceWatch" set brand = tb, flavor = tf where brand = fb and flavor = ff;

  delete from "tierListItem" a where a.brand = fb and a.flavor = ff
    and exists(select 1 from "tierListItem" b where b."tierListId" = a."tierListId" and b.brand = tb and b.flavor = tf);
  update "tierListItem" set brand = tb, flavor = tf where brand = fb and flavor = ff;

  delete from "drinkSwipe" a where a.brand = fb and a.flavor = ff
    and exists(select 1 from "drinkSwipe" b where b."userId" = a."userId" and b.brand = tb and b.flavor = tf);
  update "drinkSwipe" set brand = tb, flavor = tf where brand = fb and flavor = ff;

  update "drinkLog" set brand = tb, flavor = tf where brand = fb and flavor = ff;
  -- Questions about the drink move with it; their answers hang on the question.
  update "drinkQuestion" set brand = tb, flavor = tf where brand = fb and flavor = ff;
  -- A drink attached to a wall record, a comment or a chat message follows it too.
  update "profileComment" set "drinkBrand" = tb, "drinkFlavor" = tf where "drinkBrand" = fb and "drinkFlavor" = ff;
  update "wallReply" set "drinkBrand" = tb, "drinkFlavor" = tf where "drinkBrand" = fb and "drinkFlavor" = ff;
  update "chatMessage" set "drinkBrand" = tb, "drinkFlavor" = tf where "drinkBrand" = fb and "drinkFlavor" = ff;

  update "gachaCard" b set count = b.count + a.count, "firstAt" = least(a."firstAt", b."firstAt"), "lastAt" = greatest(a."lastAt", b."lastAt"),
      rarity = case when array_position(array['common','rare','epic','legendary'], a.rarity) > array_position(array['common','rare','epic','legendary'], b.rarity) then a.rarity else b.rarity end
    from "gachaCard" a where a.brand = fb and a.flavor = ff and b."userId" = a."userId" and b.brand = tb and b.flavor = tf;
  delete from "gachaCard" a where a.brand = fb and a.flavor = ff
    and exists(select 1 from "gachaCard" b where b."userId" = a."userId" and b.brand = tb and b.flavor = tf);
  update "gachaCard" set brand = tb, flavor = tf where brand = fb and flavor = ff;
  update "gachaPull" set brand = tb, flavor = tf where brand = fb and flavor = ff;
  -- «Премия за энергию»: the nominee and its votes move to the kept drink (a member has one vote per category, so no clash).
  insert into "awardNominee"(award, category, brand, flavor, seeded, "addedBy", "createdAt")
    select award, category, tb, tf, seeded, "addedBy", "createdAt" from "awardNominee" where brand = fb and flavor = ff
    on conflict (award, category, brand, flavor) do update set seeded = "awardNominee".seeded or excluded.seeded;
  update "awardVote" set brand = tb, flavor = tf where brand = fb and flavor = ff;
  delete from "awardNominee" where brand = fb and flavor = ff;
  perform set_config('canrush.identity_move', 'off', true);
end $$;
