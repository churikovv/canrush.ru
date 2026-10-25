-- Аватарка автора берётся подзапросом в каждой строке ленты, отзывов, тирлистов и каталога
-- (`select id from "profileImage" where "userId" = u.id and kind = 'avatar'`); без индекса это полный просмотр таблицы
-- на каждую строку. Индекс по участнику и виду делает его точечным.
create index if not exists profile_image_user_kind on "profileImage" ("userId", kind);
