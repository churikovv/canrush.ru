-- Ещё два напитка участников оказались дублями карточек парсера:
--  · «100 Kwt · citrus» («100 Kwt atomic citrus», серебряная банка коллаборации Atomic Heart с грейпфрутом) → «100 Kwt ·
--    Грейпфрут + Апельсин» — склеено по просьбе владельца сайта;
--  · «X-Turbo · Персик + Сакура» («X-Turbo персик сакура», старый дизайн банки) → «X-Turbo · peach», карточка парсера
--    «X-Turbo Персик-Сакура» (новый дизайн Asian Blast).
-- Как в 0101: данные переезжают функцией из 0098, дубль удаляется, выплаченный опыт остаётся, старые адреса — в реестре.
select move_drink_identity('100 Kwt', 'citrus', '100 Kwt', 'blend:grapefruit+orange');
delete from "catalogDrink" where brand = '100 Kwt' and flavor = 'citrus';
select move_drink_identity('X-Turbo', 'blend:peach+Сакура', 'X-Turbo', 'peach');
delete from "catalogDrink" where brand = 'X-Turbo' and flavor = 'blend:peach+Сакура';
