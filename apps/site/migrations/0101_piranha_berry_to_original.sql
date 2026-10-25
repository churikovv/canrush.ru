-- «Piranha's · berry» — напиток участника («Piranha's slam classic energy»), но на его фото та же чёрная банка
-- Slam Classic Energy, что у карточки парсера «Piranha's · original». Всё, что оставили на дубле (отзывы с комментариями,
-- лайками и фото, тирлисты, свайпы, календарь, избранное), переезжает на оригинал функцией из 0098, а сам дубль удаляется;
-- выплаченный автору опыт остаётся, как при любом удалении напитка. Старый адрес ведёт на оригинал (product-slugs.json).
select move_drink_identity('Piranha''s', 'berry', 'Piranha''s', 'original');
delete from "catalogDrink" where brand = 'Piranha''s' and flavor = 'berry';
