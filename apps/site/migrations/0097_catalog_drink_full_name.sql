-- Полное название напитка с банки (например «Monster Ultra Paradise»), необязательно: по нему напиток находит поиск
-- каталога и выбор напитка, а страница напитка показывает его под вкусом. Идентичность по-прежнему бренд + вкус.
alter table "catalogDrink" add column "fullName" text not null default '' check (char_length("fullName") <= 80);
