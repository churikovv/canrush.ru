lock table review, favorite, "favoritePriceWatch", "tierListItem" in exclusive mode;
alter table review disable trigger review_prevent_blocked_contribution;
alter table favorite disable trigger favorite_experience;


-- Pulseup: original
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Pulseup' and a.flavor='original' and b.brand='Pulseup' and b.flavor='pulse_your') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Pulseup', flavor='pulse_your' where brand='Pulseup' and flavor='original';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Pulseup','pulse_your',"createdAt" from favorite where brand='Pulseup' and flavor='original' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Pulseup','pulse_your',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Pulseup' and flavor='original' on conflict do nothing;
delete from favorite where brand='Pulseup' and flavor='original';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Pulseup','pulse_your',tier,position from "tierListItem" where brand='Pulseup' and flavor='original' on conflict do nothing;
delete from "tierListItem" where brand='Pulseup' and flavor='original';

-- Pulse Up: unresolved:b96f7fc42f5cae9f5a02852a
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Pulse Up' and a.flavor='unresolved:b96f7fc42f5cae9f5a02852a' and b.brand='Pulseup' and b.flavor='pulse_your') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Pulseup', flavor='pulse_your' where brand='Pulse Up' and flavor='unresolved:b96f7fc42f5cae9f5a02852a';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Pulseup','pulse_your',"createdAt" from favorite where brand='Pulse Up' and flavor='unresolved:b96f7fc42f5cae9f5a02852a' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Pulseup','pulse_your',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Pulse Up' and flavor='unresolved:b96f7fc42f5cae9f5a02852a' on conflict do nothing;
delete from favorite where brand='Pulse Up' and flavor='unresolved:b96f7fc42f5cae9f5a02852a';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Pulseup','pulse_your',tier,position from "tierListItem" where brand='Pulse Up' and flavor='unresolved:b96f7fc42f5cae9f5a02852a' on conflict do nothing;
delete from "tierListItem" where brand='Pulse Up' and flavor='unresolved:b96f7fc42f5cae9f5a02852a';

-- Pulse Up: unresolved:74cdeab3f536423357eee5dd
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Pulse Up' and a.flavor='unresolved:74cdeab3f536423357eee5dd' and b.brand='Pulseup' and b.flavor='pulse_drive') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Pulseup', flavor='pulse_drive' where brand='Pulse Up' and flavor='unresolved:74cdeab3f536423357eee5dd';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Pulseup','pulse_drive',"createdAt" from favorite where brand='Pulse Up' and flavor='unresolved:74cdeab3f536423357eee5dd' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Pulseup','pulse_drive',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Pulse Up' and flavor='unresolved:74cdeab3f536423357eee5dd' on conflict do nothing;
delete from favorite where brand='Pulse Up' and flavor='unresolved:74cdeab3f536423357eee5dd';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Pulseup','pulse_drive',tier,position from "tierListItem" where brand='Pulse Up' and flavor='unresolved:74cdeab3f536423357eee5dd' on conflict do nothing;
delete from "tierListItem" where brand='Pulse Up' and flavor='unresolved:74cdeab3f536423357eee5dd';

-- 100 Kwt: orange
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='100 Kwt' and a.flavor='orange' and b.brand='100 Kwt' and b.flavor='blend:grapefruit+orange') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='100 Kwt', flavor='blend:grapefruit+orange' where brand='100 Kwt' and flavor='orange';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'100 Kwt','blend:grapefruit+orange',"createdAt" from favorite where brand='100 Kwt' and flavor='orange' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'100 Kwt','blend:grapefruit+orange',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='100 Kwt' and flavor='orange' on conflict do nothing;
delete from favorite where brand='100 Kwt' and flavor='orange';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'100 Kwt','blend:grapefruit+orange',tier,position from "tierListItem" where brand='100 Kwt' and flavor='orange' on conflict do nothing;
delete from "tierListItem" where brand='100 Kwt' and flavor='orange';

-- 100 Kwt: grapefruit
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='100 Kwt' and a.flavor='grapefruit' and b.brand='100 Kwt' and b.flavor='blend:grapefruit+orange') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='100 Kwt', flavor='blend:grapefruit+orange' where brand='100 Kwt' and flavor='grapefruit';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'100 Kwt','blend:grapefruit+orange',"createdAt" from favorite where brand='100 Kwt' and flavor='grapefruit' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'100 Kwt','blend:grapefruit+orange',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='100 Kwt' and flavor='grapefruit' on conflict do nothing;
delete from favorite where brand='100 Kwt' and flavor='grapefruit';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'100 Kwt','blend:grapefruit+orange',tier,position from "tierListItem" where brand='100 Kwt' and flavor='grapefruit' on conflict do nothing;
delete from "tierListItem" where brand='100 Kwt' and flavor='grapefruit';

-- 100 Kwt: unresolved:2a66d7b19eaab09e46d61017
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='100 Kwt' and a.flavor='unresolved:2a66d7b19eaab09e46d61017' and b.brand='100 Kwt' and b.flavor='original') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='100 Kwt', flavor='original' where brand='100 Kwt' and flavor='unresolved:2a66d7b19eaab09e46d61017';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'100 Kwt','original',"createdAt" from favorite where brand='100 Kwt' and flavor='unresolved:2a66d7b19eaab09e46d61017' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'100 Kwt','original',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='100 Kwt' and flavor='unresolved:2a66d7b19eaab09e46d61017' on conflict do nothing;
delete from favorite where brand='100 Kwt' and flavor='unresolved:2a66d7b19eaab09e46d61017';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'100 Kwt','original',tier,position from "tierListItem" where brand='100 Kwt' and flavor='unresolved:2a66d7b19eaab09e46d61017' on conflict do nothing;
delete from "tierListItem" where brand='100 Kwt' and flavor='unresolved:2a66d7b19eaab09e46d61017';

-- 100 Kwt: unresolved:cd3221b1786a268cf5c1223d
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='100 Kwt' and a.flavor='unresolved:cd3221b1786a268cf5c1223d' and b.brand='100 Kwt' and b.flavor='kwt_raw') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='100 Kwt', flavor='kwt_raw' where brand='100 Kwt' and flavor='unresolved:cd3221b1786a268cf5c1223d';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'100 Kwt','kwt_raw',"createdAt" from favorite where brand='100 Kwt' and flavor='unresolved:cd3221b1786a268cf5c1223d' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'100 Kwt','kwt_raw',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='100 Kwt' and flavor='unresolved:cd3221b1786a268cf5c1223d' on conflict do nothing;
delete from favorite where brand='100 Kwt' and flavor='unresolved:cd3221b1786a268cf5c1223d';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'100 Kwt','kwt_raw',tier,position from "tierListItem" where brand='100 Kwt' and flavor='unresolved:cd3221b1786a268cf5c1223d' on conflict do nothing;
delete from "tierListItem" where brand='100 Kwt' and flavor='unresolved:cd3221b1786a268cf5c1223d';

-- Jaguar: kiwi
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Jaguar' and a.flavor='kiwi' and b.brand='Jaguar' and b.flavor='blend:cactus+kiwi') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Jaguar', flavor='blend:cactus+kiwi' where brand='Jaguar' and flavor='kiwi';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Jaguar','blend:cactus+kiwi',"createdAt" from favorite where brand='Jaguar' and flavor='kiwi' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Jaguar','blend:cactus+kiwi',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Jaguar' and flavor='kiwi' on conflict do nothing;
delete from favorite where brand='Jaguar' and flavor='kiwi';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Jaguar','blend:cactus+kiwi',tier,position from "tierListItem" where brand='Jaguar' and flavor='kiwi' on conflict do nothing;
delete from "tierListItem" where brand='Jaguar' and flavor='kiwi';

-- Jaguar: cactus
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Jaguar' and a.flavor='cactus' and b.brand='Jaguar' and b.flavor='blend:cactus+kiwi') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Jaguar', flavor='blend:cactus+kiwi' where brand='Jaguar' and flavor='cactus';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Jaguar','blend:cactus+kiwi',"createdAt" from favorite where brand='Jaguar' and flavor='cactus' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Jaguar','blend:cactus+kiwi',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Jaguar' and flavor='cactus' on conflict do nothing;
delete from favorite where brand='Jaguar' and flavor='cactus';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Jaguar','blend:cactus+kiwi',tier,position from "tierListItem" where brand='Jaguar' and flavor='cactus' on conflict do nothing;
delete from "tierListItem" where brand='Jaguar' and flavor='cactus';

-- Jaguar: orange
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Jaguar' and a.flavor='orange' and b.brand='Jaguar' and b.flavor='blend:orange+passion_fruit') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Jaguar', flavor='blend:orange+passion_fruit' where brand='Jaguar' and flavor='orange';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Jaguar','blend:orange+passion_fruit',"createdAt" from favorite where brand='Jaguar' and flavor='orange' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Jaguar','blend:orange+passion_fruit',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Jaguar' and flavor='orange' on conflict do nothing;
delete from favorite where brand='Jaguar' and flavor='orange';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Jaguar','blend:orange+passion_fruit',tier,position from "tierListItem" where brand='Jaguar' and flavor='orange' on conflict do nothing;
delete from "tierListItem" where brand='Jaguar' and flavor='orange';

-- Jaguar: dragonfruit
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Jaguar' and a.flavor='dragonfruit' and b.brand='Jaguar' and b.flavor='blend:dragonfruit+guava') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Jaguar', flavor='blend:dragonfruit+guava' where brand='Jaguar' and flavor='dragonfruit';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Jaguar','blend:dragonfruit+guava',"createdAt" from favorite where brand='Jaguar' and flavor='dragonfruit' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Jaguar','blend:dragonfruit+guava',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Jaguar' and flavor='dragonfruit' on conflict do nothing;
delete from favorite where brand='Jaguar' and flavor='dragonfruit';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Jaguar','blend:dragonfruit+guava',tier,position from "tierListItem" where brand='Jaguar' and flavor='dragonfruit' on conflict do nothing;
delete from "tierListItem" where brand='Jaguar' and flavor='dragonfruit';

-- Jaguar: pineapple
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Jaguar' and a.flavor='pineapple' and b.brand='Jaguar' and b.flavor='blend:guava+peach+pineapple') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Jaguar', flavor='blend:guava+peach+pineapple' where brand='Jaguar' and flavor='pineapple';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Jaguar','blend:guava+peach+pineapple',"createdAt" from favorite where brand='Jaguar' and flavor='pineapple' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Jaguar','blend:guava+peach+pineapple',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Jaguar' and flavor='pineapple' on conflict do nothing;
delete from favorite where brand='Jaguar' and flavor='pineapple';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Jaguar','blend:guava+peach+pineapple',tier,position from "tierListItem" where brand='Jaguar' and flavor='pineapple' on conflict do nothing;
delete from "tierListItem" where brand='Jaguar' and flavor='pineapple';

-- Jaguar: unresolved:c5c5b1f41b859583c2766997
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Jaguar' and a.flavor='unresolved:c5c5b1f41b859583c2766997' and b.brand='Jaguar' and b.flavor='berry') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Jaguar', flavor='berry' where brand='Jaguar' and flavor='unresolved:c5c5b1f41b859583c2766997';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Jaguar','berry',"createdAt" from favorite where brand='Jaguar' and flavor='unresolved:c5c5b1f41b859583c2766997' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Jaguar','berry',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Jaguar' and flavor='unresolved:c5c5b1f41b859583c2766997' on conflict do nothing;
delete from favorite where brand='Jaguar' and flavor='unresolved:c5c5b1f41b859583c2766997';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Jaguar','berry',tier,position from "tierListItem" where brand='Jaguar' and flavor='unresolved:c5c5b1f41b859583c2766997' on conflict do nothing;
delete from "tierListItem" where brand='Jaguar' and flavor='unresolved:c5c5b1f41b859583c2766997';

-- Jaguar: unresolved:6ec9e88fe27fda61d4d700e5
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Jaguar' and a.flavor='unresolved:6ec9e88fe27fda61d4d700e5' and b.brand='Jaguar' and b.flavor='berry') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Jaguar', flavor='berry' where brand='Jaguar' and flavor='unresolved:6ec9e88fe27fda61d4d700e5';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Jaguar','berry',"createdAt" from favorite where brand='Jaguar' and flavor='unresolved:6ec9e88fe27fda61d4d700e5' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Jaguar','berry',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Jaguar' and flavor='unresolved:6ec9e88fe27fda61d4d700e5' on conflict do nothing;
delete from favorite where brand='Jaguar' and flavor='unresolved:6ec9e88fe27fda61d4d700e5';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Jaguar','berry',tier,position from "tierListItem" where brand='Jaguar' and flavor='unresolved:6ec9e88fe27fda61d4d700e5' on conflict do nothing;
delete from "tierListItem" where brand='Jaguar' and flavor='unresolved:6ec9e88fe27fda61d4d700e5';

-- Jaguar: unresolved:89eea0013f5a74d684ce4a8e
do $$ begin if exists(select 1 from review a join review b on a."userId"=b."userId" where a.brand='Jaguar' and a.flavor='unresolved:89eea0013f5a74d684ce4a8e' and b.brand='Jaguar' and b.flavor='original') then raise exception 'Alias merge requires manual review conflict resolution'; end if; end $$;
update review set brand='Jaguar', flavor='original' where brand='Jaguar' and flavor='unresolved:89eea0013f5a74d684ce4a8e';
insert into favorite("userId",brand,flavor,"createdAt") select "userId",'Jaguar','original',"createdAt" from favorite where brand='Jaguar' and flavor='unresolved:89eea0013f5a74d684ce4a8e' on conflict do nothing;
insert into "favoritePriceWatch"("userId",brand,flavor,city,volume,price,"snapshotAt") select "userId",'Jaguar','original',city,volume,price,"snapshotAt" from "favoritePriceWatch" where brand='Jaguar' and flavor='unresolved:89eea0013f5a74d684ce4a8e' on conflict do nothing;
delete from favorite where brand='Jaguar' and flavor='unresolved:89eea0013f5a74d684ce4a8e';
insert into "tierListItem"("tierListId",brand,flavor,tier,position) select "tierListId",'Jaguar','original',tier,position from "tierListItem" where brand='Jaguar' and flavor='unresolved:89eea0013f5a74d684ce4a8e' on conflict do nothing;
delete from "tierListItem" where brand='Jaguar' and flavor='unresolved:89eea0013f5a74d684ce4a8e';

alter table review enable trigger review_prevent_blocked_contribution;
alter table favorite enable trigger favorite_experience;
