-- «Дейтинг» напитков в сообществе: свайп вправо — «нравится», влево — «пропустить». Одна строка на участника и
-- напиток (повторный свайп меняет решение), «вернуть» удаляет строку. Свайпы питают рекомендации «Тебе понравится»
-- и счётчики «Свайпнули» / «Пропустили» на странице напитка.
create table "drinkSwipe" (
  "userId" text not null references "user"(id) on delete cascade,
  brand text not null check (char_length(brand) between 1 and 120),
  flavor text not null check (char_length(flavor) between 1 and 120),
  liked boolean not null,
  "createdAt" timestamptz not null default now(),
  primary key ("userId", brand, flavor)
);
create index drink_swipe_drink on "drinkSwipe"(brand, flavor);
create index drink_swipe_recent on "drinkSwipe"("userId", "createdAt" desc);
