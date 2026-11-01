-- Dr.drinks и Dr.Drinks — один бренд: две заявки стояли на проверке одновременно, поэтому вторая не взяла написание первой, и в каталоге
-- бренд раздвоился. Напитки разные (манго-маракуйя, ягодный, два барбариса), дублей нет, поэтому склеиваем только написание:
-- данные «Манго маракуйя» переезжают функцией из 0098, а старый адрес ведёт на новый, как при правке в админке.
update "catalogDrink" set brand = 'Dr.Drinks', "fullName" = 'Dr.Drinks Mango Passion', "updatedAt" = clock_timestamp()
  where brand = 'Dr.drinks' and flavor = 'Манго маракуйя';
select move_drink_identity('Dr.drinks', 'Манго маракуйя', 'Dr.Drinks', 'Манго маракуйя');
update "battleCardStat" set brand = 'Dr.Drinks' where brand = 'Dr.drinks' and flavor = 'Манго маракуйя';
update "catalogEvent" set brand = 'Dr.Drinks' where brand = 'Dr.drinks' and flavor = 'Манго маракуйя';
insert into "catalogDrinkRename" ("drinkId", "fromBrand", "fromFlavor", "toBrand", "toFlavor")
  select id, 'Dr.drinks', flavor, brand, flavor from "catalogDrink" where brand = 'Dr.Drinks' and flavor = 'Манго маракуйя';
