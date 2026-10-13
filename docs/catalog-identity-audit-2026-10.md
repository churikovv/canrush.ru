# Проверка архивных идентичностей, 13 октября 2026

Причина: восстановление реестра из старых снимков вернуло прежние бренды,
однокомпонентные вкусы и агрегаты unknown. Сейчас alias-нормализация применяется
при чтении сайта и записи архива. Старые URL перенаправляются на канонические.
Миграция 0039 переносит отзывы, избранное, наблюдения цен и тирлисты; при двух
отзывах одного автора о склеиваемых идентичностях отменяет транзакцию.

Подтверждения: сохранённые названия в data/history и data/regions/*/history,
названия из параметра text предложений Едадила, локальные изображения упаковок.

- Monster Strawberry / Strawberry Zero: Ultra Strawberry Dreams, подтверждено
  упаковкой и историческими названиями; Strawberry Shot остаётся отдельно.
- Monster Orange: исходное название явно содержит Nitro и апельсин/лимон.
- Volt Mint / Pomelo: помело–мята; Strawberry: грейпфрут–клубника;
  Grape: виноград–гуава; Lime: манго–лайм; старый Volt Mango: кокос–манго.
- Volt Energy Mango неоднозначен: исторически содержал и кокос–манго, и
  манго–лайм. Не склеивается, исключён из архивного поиска.
- Volt Original: изображение b2840d7faea33c0d.jpg показывает «Ягодное драже».
  Создан отдельный вкус berry_dragee; Volt Energy Original остаётся отдельно.
- Lit Coconut / Mango: кокос–манго; Strawberry / Bubblegum / два unresolved
  клубничной жвачки: клубничная жвачка; Peach: манго–персик.
- Lit Turbo и Turbo Zero: обе упаковки явно «без сахара», одна идентичность.
- Flash Banana / Feijoa: банан–фейхоа; Flesh Mango: манго–ананас;
  Flesh Peach / Flash Peach: Zero Mode персик–голубика.
- Flash unresolved f13c… и 6ebe…: исходные названия Flash Up Max.
- Сокращённые «энергетич.», «б/сах» у Red Bull мешали распознаванию Original
  и Sugarfree; добавлены проверенные aliases и обработка сокращений.

Не переименовываются наугад:
- Общие unknown у Monster, Volt, Lit, Burn, Red Bull, Flash: исторические
  агрегаты многих разных напитков. Старые ссылки сохранены, архивная выдача
  их не показывает.
- Lit unresolved 0cfdd…; Flash 6f986… и 7f516…: «в ассортименте», конкретный
  вкус не указан. Также исключены из архивной выдачи.
- Red Bull Krating, Fruit Mix, Krating Daeng Extra Zinc: отдельные импортные
  продукты, не являются доказанными дубликатами европейского Original.

Локально применена 0039 и выполнена переиндексация сохранённых предложений.
Для прода после доставки кода: сборка shared/parser, db:plan, db:migrate,
затем reindexCatalog (без сетевого парсинга). Не переносить local data в Git.

## Дополнительная проверка

Миграции 0040–0041: версии Red Bull Fruit Mix, Krating Daeng и Extra Zinc;
пары Volt Cherry/Cherry Cola, Peach, Blueberry/Pomegranate, Plum Pie;
Drive Me Zero Sugar Guava Mango, Cactus/Lulo, Citrus и Berry;
смеси Байкал Cherry/Strawberry, Blackcurrant/Raspberry, Coffee/Lemon.
Adrenaline: Red → Berry, Pineapple → Pineapple/Pomelo,
Calamansi и Strawberry → Yuzu/Strawberry/Calamansi,
Pomegranate → Spicy, Passion Fruit → sugarfree, Mango/Tropical → Tropical.
Последние соответствия проверены по сохранённым названиям и упаковкам.

Drive Me unresolved e0f636… и три рекламных Adrenaline с ассортиментом не
определяют конкретную банку: скрыты из каталога; старые страницы объясняют
причину и не показывают рекламную листовку вместо фотографии напитка.

Миграция 0042: Adrenaline Rush Mango → Adrenaline Game Fuel Mango (сохранена
указанная актуальная ссылка), Adrenaline Strawberry/Calamansi → смесь Юдзу,
Adrenaline Orange → Rush Orange, Adrenaline Original/Berry → Rush Berry.
У старого Original обложка явно Vitamin Power «Ягодная энергия»; настоящая
карточка Adrenaline Rush Original не изменяется. Vitamin Power теперь не
считается автоматически ягодным: Mango/Orange распознаются отдельно.

Миграция 0043: Flash Up Blueberry, Flesh Blueberry и Flesh Original →
Flash Up Blueberry Donut (на всех соответствующих обложках пончик).
Flesh Bubblegum и Flash Up Strawberry → Flash Up Bubblegum.
Flash Up Blueberry/Peach → sugarfree: обе обложки явно Zero Mode / Sugar Free.

Миграция 0045: Pulseup Original и Pulse Up unresolved b96f… → Your Energy;
Pulse Up unresolved 74c… → Drive. 100 Kwt Orange/Grapefruit → смесь;
unresolved 2a66… → Original (надпись на ПЭТ-упаковке), cd32… → отдельная
версия Raw Energy (название магазина и надпись на банке).
Jaguar Kiwi/Cactus, Orange, Dragonfruit, Pineapple → соответствующие смеси.
У Jaguar unresolved c5c5… и 6ec9… на упаковках «Ягодный микс», у 89ee…
«Оригинальный». Live/Cult/Free сохранены как отдельные версии.

Миграция 0046: Gorilla Berry → Berry Blast, Blueberry → Berry Bloom,
Coconut → Coconut/Mango. Gorilla unresolved 60396… — листовка ассортимента;
2c1c… — название Sugar Free в ассортименте, фото Bubble Gum. Обе не являются
достоверной отдельной карточкой; скрыты из каталога, старые URL объясняют
причину без рекламных/противоречивых картинок.
