-- Награды сезона теперь у десятки: прежнее ограничение пускало только первые три места.
alter table "monthlyTopAward" drop constraint "monthlyTopAward_place_check";
alter table "monthlyTopAward" add constraint "monthlyTopAward_place_check" check (place between 1 and 10);
