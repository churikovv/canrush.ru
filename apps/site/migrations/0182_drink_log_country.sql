-- Страна банки в трекере выпитого: необязательная деталь рядом с ценой и магазином, видит её только владелец. Код ISO 3166-1 alpha-2, как у отзывов.
alter table "drinkLog" add column country text check (country ~ '^[A-Z]{2}$');
