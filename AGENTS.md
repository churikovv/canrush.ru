# AGENTS.md — canrush.ru

Monorepo: парсер цен на энергетические напитки (РФ) + сайт.
npm workspaces, TypeScript, Next.js, Playwright, vitest.

## Структура

```
packages/shared/   # общие типы (Product, SourceName, конфиги) — собирается в dist/
apps/parser/       # парсер цен (Playwright + HTTP + фиды)
apps/site/         # Next.js сайт + Better Auth Magic Link + PostgreSQL
data/              # выходные данные парсера (latest.json, raw/, history/, state.json)
```

## Источники и адаптеры

`apps/parser/src/adapters/`:

| Источник     | Файл            | Стратегия                                   |
| ------------ | --------------- | ------------------------------------------- |
| Wildberries  | `wildberries.ts`| `intercept` (перехват JSON API)             |
| Ozon         | `ozon.ts`       | `feed` (партнёрский XML, `OZON_FEED_URL`) → `intercept` |
| Пятёрочка    | `pyaterochka.ts`| `in_page_fetch` (fetch внутри страницы)     |
| Магнит       | `magnit.ts`     | `in_page_fetch` (нужны `storeCode`, `categoryId`) |
| Лента        | `lenta.ts`      | `in_page_fetch`                             |
| Едадил       | `edadeal.ts`    | `http_api` (открытый JSON `search.edadeal.io`, без браузера; только акции; `regionId` = Yandex geoid) |
| Яндекс Лавка | `lavka.ts`      | `http_api` (SSR-страница каталога большой лавки + cookie `lastGeoCoordinate`; полный прайс; города — `sources.lavka.cities`) |

Антибот: `src/browser/challenge.ts` (детект), `src/browser/session.ts`
(переиспользование сессий в `.sessions/<source>/`). Разблокировка —
`npm run session:unlock -- --source=<name>` (см. `apps/parser/README.md`).

## Команды (из корня)

```bash
npm install
npx playwright install chromium

npm run dev          # Next.js сайт на http://localhost:3000
npm run build        # сборка всех workspaces (shared → parser/site)
npm run lint         # flat ESLint для parser/shared/site
npm test             # unit-тесты всех workspaces
npm run parse        # однократный прогон парсера
npm run parse -- --source=ozon,wildberries
npm run schedule     # планировщик (CRON_SCHEDULE из .env, по умолч. 0 6 * * * Europe/Moscow)
```

Команды парсера также доступны через workspace:
`npm -w apps/parser run doctor`, `npm -w apps/parser run session:unlock -- --source=...`.

Команды сайта:
`npm -w apps/site run typecheck`, `npm -w apps/site run db:plan`,
`npm -w apps/site run db:migrate`, `npm -w apps/site run test:auth`.

## Важно для агентов

- **Сборка зависит от порядка**: `@canrush/shared` собирается в `dist/` первым
  (через `npm run build --workspaces`); `apps/parser` импортирует типы из
  `@canrush/shared` через `references` в `tsconfig.json`. Перед `npm run parse`
  убедись, что `packages/shared/dist` существует (`npm run build`).
- **ESM + NodeNext**: импорты локальных файлов обязаны иметь расширение `.js`
  (например `from './storage.js'`). Импорты из `@canrush/shared` — без расширения.
- **`noUncheckedIndexedAccess: true`**: результат индексного доступа (`arr[i]`,
  `map.get(k)`) считается `T | undefined` — обрабатывай undefined явно.
- **Next.js site**: `apps/site/tsconfig.json` намеренно использует `module: ESNext`
  и `moduleResolution: Bundler`; правило расширений `.js` из NodeNext к нему не
  применяется. Корневой `npm run dev` запускает этот workspace.
- **Данные каталога сайта**: `saveLatest` синхронизирует группы в игнорируемый
  `apps/site/data/catalog.json`. После парсинга запускай `npm -w apps/parser run
  download-images`, чтобы локализовать изображения и обновить этот срез.
- **Magic Link invariants**: токен живёт 15 минут, хранится как хэш и погашается
  один раз. Email-ссылка ведёт на GET interstitial, а вход выполняется только
  автоматическим POST через Server Action. Action вызывает встроенный `magicLinkVerify`
  и переносит его `Set-Cookie` через Next `cookies()`; не редиректь Action на
  внутренний verifier, иначе Next RSC потеряет cookie. Не возвращай verifier в
  письмо, не делай callback URL пользовательским и не отключай origin checks.
- **Auth anti-abuse**: запрос письма ограничен database rate limit по IP и HMAC
  нормализованного email. Не сохраняй raw email в ключе лимитера и не переноси
  запрос отправки на server-side `auth.api`, иначе встроенный IP limit обходится.
- **Site secrets**: `DATABASE_URL`, `BETTER_AUTH_SECRET` и SMTP-реквизиты только
  в `apps/site/.env.local`/secret manager. `SMTP_USER` обязан совпадать с From,
  SpaceWeb использует implicit TLS на 465. Не используй раскрытый старый пароль.
- **Миграции сайта**: SQL хранится в `apps/site/migrations/`, checksum — в
  `_canrush_migrations`. Сначала запускай `db:plan`; integration-тесты используют
  только отдельную `canrush_site_test` и не должны делать `DROP`/`TRUNCATE`.
- **Figma**: auth/profile адаптированы из узлов `454:2493` и `465:2035`; точные
  assets находятся в `apps/site/public/brand`, PP Object Sans — в
  `apps/site/fonts`, токены — в `DESIGN.md`. Не подменяй логотипы и не добавляй
  runtime-ссылки на временные Figma assets.
- **Навигация сайта**: `ProfileNavigation` рендерит кнопки хедера (≥960px) и
  таб бар `SiteTabBar` (<960px), иконки общие (`navigation-icon.tsx`). В хедере два
  выпадающих меню `HeaderMenu` — «Сообщество» (Тирлисты, Объявления, Лента) и «Магазины»
  (Каталог, Цены, Найти → `/market/stores`) — и «Профиль». Подпись группы — ссылка на её первую
  страницу (`/tierlists`, `/catalog`), меню открывается наведением или кнопкой-стрелкой рядом; таб бар по-прежнему из шести
  вкладок. Страницы `/market/stores*` передают `active="stores"`: в меню отмечается «Найти»,
  в таб баре — «Магазины». Таб бар
  фиксирован снизу и задаёт `--site-tab-bar-offset` на `html` только там, где он
  есть (юридические страницы и админка без `ProfileNavigation` его не показывают).
  Новые фиксированные снизу элементы и нижние отступы считай через
  `calc(var(--site-tab-bar-offset, 0px) + …)`, иначе таб бар их перекроет.
- **Тесты**: vitest, файлы `apps/parser/test/*.test.ts`. `tsconfig.json` парсера
  включает только `src` — тесты компилируются vitest'ом на лету, не падают в
  `dist`. Не добавляй `test/` в `include` tsconfig (это ломает `rootDir`/`outDir`).
- **Регулярки с кириллицей**: не используй `\b` рядом с кириллическими буквами
  без флага `u` — JS считает word-границу только по ASCII. См. `extractVolumeMl`
  в `apps/parser/src/normalize.ts` (используется `(?![a-zа-яё])`).
- **Не коммить**: `.sessions/`, `data/raw/`, `data/history/`, `data/latest.json`,
  `data/state.json`, `apps/site/data/`, `apps/site/public/images/`, `.env` (см. `.gitignore`).
- **Робототехника**: `src/robots.ts` уважает `robots.txt`. Не отключай его.
- **Поиск по брендам**: русские и другие «как пишут» написания — в `BRAND_SEARCH_ALIASES` (`apps/site/src/lib/search-aliases.ts`), плюс автотранслитерация в обе стороны. Не добавляй их в `ENERGY_DRINK_BRAND_ALIASES`: по ним парсер определяет бренд в названиях товаров. Новый бренд с неочевидным чтением («Juster» → «Джастер») — сразу в поисковый словарь.
- **Едадил — агрегатор**: `source: 'edadeal'`, а сеть (Пятёрочка/Магнит/…) — в
  `Product.retailer`; цены только акционные (`promoEndsAt`). Это единственный
  источник без Playwright — не добавляй ему браузерных стратегий и не ходи на
  запрещённые в `robots.txt` страницы `edadeal.ru` (поиск, `/offers/*`). Полная
  выдача собирается через брендовые батчи (обычный ответ обрезан до 600 групп),
  бренд — по `brandUuid`, затем через глобальные `brandAliases`. Не убирай паузу
  800 мс между запросами.
- **Яндекс Лавка**: только «большая лавка» (`/supermarket/…`, `depotType=supermarket`),
  её нет за пределами Москвы и Петербурга — «лавку у дома» и демо-каталог адаптер
  отбрасывает (`hasSupermarket`). Данные — из SSR `storedehydratedstate-data`, товары
  только из подразделов «Энергетики…» (в категории `energy_beer` есть пиво и вино).
  `/api/` запрещён в robots.txt — не ходи туда и не включай перехват XHR; headless
  получает 403, капчу не обходим. Лавка опрашивается в региональном прогоне рядом с
  Едадилом, её сбой оставляет прошлые цены Лавки как stale (`fetchLavka` в `regions.ts`). На капчу/запрет (`SourceBlockedError`) — ровно один повтор через 60–90 с: с сервера капча бывает разовой; больше повторов не добавляй.
- **Обложки архива**: если картинку не удалось скачать в прогоне, у группы остаётся ссылка CDN Едадила, и с ней карточка уходит в `product-registry.json`. `localizeArchivedCovers` (конец регионального прогона и `download-images`) докачивает такие обложки, повторы после ошибки — не чаще раза в час (`image-cache`). Ссылки CDN протухают, а превью коллекций и магазинов показывают только локальные обложки.
- **Иконки сетей**: адаптер Едадила кладёт логотип сети (`partner.imageUrl`) в
  `Product.retailerIconUrl`. `npm -w apps/parser run download-icons` скачивает
  его в `apps/site/public/images/retailers/` (общий volume с сайтом) и пишет в
  `apps/site/data/retailer-icons.json` запись `{ src, tile }`; favicon по домену —
  только запасной вариант. Логотипы принимаются лишь с `https://leonardo.edadeal.io`.
  Сайт показывает `tile` на всю плашку, ручные иконки из `public/brand/retailers`
  имеют приоритет. Запускай после парсинга вместе с `download-images`.
- **Антибот/блокировки — это норма**: источники часто возвращают 403/498/капчу.
  Не пытайся «обойти» защиту агрессивнее — используй `session:unlock` и
  stale-фоллбэк (`mergeResults` в `storage.ts`). Не увеличивай частоту запросов
  сверх разумного (базовая задержка 3с + джиттер в `run.ts`).
- **Безопасность**: не логируй и не коммить токены (`TG_BOT_TOKEN`, `OZON_FEED_URL`
  с ключами). Секреты — только в `.env`/`.env.local`, которые в `.gitignore`.

## Telegram Mini App

- Тот же сайт открывается в Telegram как Mini App; вне Telegram ничего не меняется. `TelegramMiniApp` (корневой layout) включается, только если в hash есть `tgWebAppData` (или маркер в `sessionStorage` после перезагрузки): ставит `data-telegram-app` на `html`, грузит SDK `telegram.org` (разрешён в CSP), ведёт `BackButton` и открывает внешние ссылки через `openLink`/`openTelegramLink`.
- Вход — плагин Better Auth `telegramMiniApp` (`src/lib/telegram-auth.ts`), `POST /api/auth/telegram/sign-in`. Сервер проверяет HMAC `initData` токеном бота и `auth_date` ≤ 24 ч (`telegram-init-data.ts`); клиентским `initDataUnsafe` не доверяй. Связь — строка `account` (`providerId='telegram'`, `issuer='local:telegram'`, `accountId` = Telegram id), уникальность даёт индекс `(issuer, accountId)`; миграция не нужна.
- Новый аккаунт создаётся только явной кнопкой «Продолжить с Telegram» (`createAccount: true`), иначе ответ `unlinked` — чтобы владелец email-аккаунта мог привязать его, а не получить дубль. Почта таких аккаунтов — заглушка `<username>@<id>.telegram.invalid` (`isTelegramPlaceholderEmail`): письма на неё не уходят, отвязать Telegram у такого аккаунта нельзя.
- Привязка: Настройки → `createTelegramLink` кладёт одноразовый код (хэш в `verification`, 10 мин) и открывает `TELEGRAM_MINI_APP_URL?startapp=link_<code>`; код приходит в подписанном `start_param` и погашается `consumeVerificationValue`.
- Вход на сайте для всех — кнопка «Войти через Telegram» (`telegram-sign-in.tsx`), почта — запасной вариант ниже. Внутри Mini App кнопка входит по `initData` (поле почты скрыто), в браузере — через бота: `POST /api/auth/telegram/login/start` кладёт в `verification` состояние под `telegram-login:<sha256(token)>` на 5 минут и ставит подписанную cookie с nonce, браузер открывает `t.me/<bot>?start=login_<token>` и опрашивает `/telegram/login/poll`. Бот (`telegram-bot/login.ts`) присылает «Подтвердить вход / Это не я» и меняет состояние; poll проверяет nonce (вход начат в этом браузере), погашает строку один раз и создаёт аккаунт, если Telegram ещё не привязан. Не убирай шаг подтверждения в боте — без него чужая ссылка `login_` впустила бы злоумышленника в аккаунт того, кто нажал Start. Работает только при живом webhook.
- `TELEGRAM_BOT_TOKEN` и `TELEGRAM_MINI_APP_URL` — в `apps/site/.env.local`; без них функция выключена. Telegram Web (web.telegram.org, iframe) не поддерживается: `frame-ancestors 'none'`/`X-Frame-Options: DENY` оставлены намеренно.
- Нижние отступы в Mini App учитывают `--tg-safe-area-inset-bottom` (правило таб бара в `globals.css`). Тесты: `test/telegram-init-data.test.ts`, `test/telegram-auth.integration.test.ts`.

## Telegram-бот

- Тот же бот, что у Mini App. Код — `apps/site/src/lib/telegram-bot/`, webhook — `POST /api/telegram/webhook` (проверяет `X-Telegram-Bot-Api-Secret-Token` = `TELEGRAM_WEBHOOK_SECRET`; без секрета роут отвечает 404). Регистрация webhook, команд и кнопки меню — `npm -w apps/site run telegram:setup`; inline-режим включается вручную через `/setinline` в @BotFather.
- Миграция `0057_telegram_bot.sql`: `telegramChat` (кто нажал /start, город, переключатели, `blockedAt`), `telegramOutbox` (очередь), `telegramJobRun` (захват периода задачи), `telegramPromoSeen` (уже объявленные акции). Аккаунт находится через `account` с `providerId='telegram'`; без привязки бот умеет только поиск и подборку недели.
- Не шли сообщения напрямую из запросов: пиши в очередь через `enqueueTelegram`/SQL `telegram_enqueue` с уникальным `dedupeKey` — функция сама проверяет чат, блокировку и переключатель. Очередь хранит вид + данные, текст рендерит отправитель (`renderOutboxMessage`), поэтому HTML экранируется в одном месте (`format.ts`).
- Уведомления сайта зеркалит триггер `notification_telegram` (после фильтра настроек сайта). Маркет — `notifyMarket` в `market.ts` внутри той же транзакции; поток сообщений одного заказа — не чаще раза в 10 минут.
- Воркер стартует из `src/instrumentation.ts` в процессе сайта (`TELEGRAM_WORKER=off` отключает): раз в секунду до 20 сообщений (лимит Telegram 30/с), строки берутся с арендой на 2 минуты и `skip locked`; 429 — повтор после `retry_after`, 403 — чат помечается заблокированным. Расписание по Москве: 04:00 чистка, 09:00 сводка админам (только с привязанным Telegram и `siteAdmin`), 10:00 акции на избранное, понедельник 11:00 подборка недели. Каждая задача сначала вставляет `(job, period)` в `telegramJobRun`, при ошибке удаляет — так несколько инстансов не дублируют рассылку.
- Исходящие запросы к Bot API идут на `TELEGRAM_API_URL` (по умолчанию `https://api.telegram.org`, читает `getTelegramApiUrl`; его же использует `telegram-setup.mjs`). С российского хостинга Telegram недоступен, а HTTP-прокси с CONNECT режет ТСПУ по SNI, поэтому на зарубежном VPS стоит reverse proxy со своим доменом и TLS, который проксирует на `api.telegram.org`. Только HTTPS: токен бота передаётся в пути запроса. Входящий трафик ТСПУ тоже режет (`getWebhookInfo` показывает `Connection timed out`), поэтому `TELEGRAM_WEBHOOK_URL` задаёт адрес на том же relay, который пересылает запрос на `/api/telegram/webhook` сайта; заголовок `X-Telegram-Bot-Api-Secret-Token` проходит насквозь. Адрес webhook использует только `telegram-setup.mjs`.
- Переключатели бота общие для `/settings` и страницы настроек — `TELEGRAM_BOT_OPTIONS` (`settings.ts`); имена колонок только из этого списка. Тесты: `test/telegram-bot.test.ts`, `test/telegram-bot.integration.test.ts` (fetch замокан, сообщения не уходят).

## Маркет и переписка

- `/market` и `/messages` используют `src/lib/market.ts`; миграции `0020_market.sql`, `0021_market_stock.sql`.
- Цена за одну банку хранится в копейках, `marketListing.quantity` — доступный остаток. Создание заказа резервирует количество под блокировкой строки; отмена возвращает его один раз, завершение не возвращает. `unitPrice` и `quantity` заказа фиксируются при создании.
- Только активный заказ уникален для пары объявление/покупатель; повторное нажатие открывает его переписку. После отмены/завершения можно заказать снова. Старые заказы имеют `stockReserved=false`; неизвестный остаток старых объявлений миграция не выдумывает (0). Автор вручную закрывает объявление.
- Статусы: `new` → `confirmed` (продавец) → `completed` (покупатель); до завершения обе стороны могут отменить. Оплата и доставка вне сайта.
- Фото объявлений публичны, вложения сообщений доступны только участникам через `/api/market-photos/[id]`, без кеширования. Не раскрывать вложения через публичные URL или Next Image optimizer.
- Проверка маркета: `npm -w apps/site test -- test/market-fields.test.ts test/site-navigation.test.tsx`, `npm -w apps/site run test:auth -- test/market.integration.test.ts` (после миграции отдельной тестовой БД).
- Мобильный таб-бар и хедер: Каталог, Магазины (`/prices`, раздел `prices`), Тирлисты, Лента (`/feed`), Маркет, Профиль. Главная доступна через логотип.
- Вкладки разделов — `src/components/section-tabs.tsx`: `MarketTabs` (Все объявления, Мои объявления, Заказы → `/messages`) и `StoreTabs` (Цены → `/prices`, Магазины и Мои магазины → `/market/stores`). URL не менялись; `/messages*` подсвечивают раздел `market`, `/market/stores*` — раздел `stores` (в таб баре это вкладка «Магазины», как и `prices`). Приватные вкладки скрыты для гостей.
- Браузерная проверка: `node apps/site/scripts/market-smoke.mjs`. Требует сборку и отдельный сервер на `localhost:3100` с `DATABASE_URL=postgresql://localhost:5432/canrush_site_test`, `BETTER_AUTH_URL=http://localhost:3100`, `BETTER_AUTH_SECRET=canrush-market-browser-test-secret-32-bytes` (фиктивный секрет только тестового сервера). Создаёт и очищает только собственные тестовые аккаунты, не отправляет письма.

## Магазины

- `/market/stores` (`src/lib/stores.ts`, `store-fields.ts`, `store-catalog.ts`), публичная страница — `/market/stores/[id]` (`getVisibleStore`: опубликован, или автор, или админ). Миграции `0036`, `0037`, `0058_store_locations.sql`.
- Точку задаёт адрес: форма геокодирует его через server action `geocodeStoreAction` → HTTP Геокодер (`store-geocoder.ts`) с отдельным ключом `YANDEX_GEOCODER_API_KEY` (только сервер, вход обязателен, до 20 запросов в минуту на аккаунт); без этого ключа — в браузере через `ymaps.geocode` с ключом карты. Координаты необязательны; поставленные вручную (клик по карте/поля) приоритетнее адреса — `locationSource` = `manual`/`geocoded`, у магазина без точки все три поля `null` (check `market_store_location`). Если геокодер недоступен, форма предлагает поставить точку вручную.
- Станции метро, МЦК и МЦД с координатами — статичный `src/lib/stores/metro.json` из открытого `api.hh.ru/metro`; обновление `npm -w apps/site run metro:update`. id станций хранятся в БД: скрипт сохраняет пропавшие из hh.ru станции. Если станция не выбрана, сервер подставляет ближайшую в пределах `NEAREST_METRO_KM`.
- Напиток магазина — `{brand, flavor}` группы каталога (имя и ссылку на карточку сервер проверяет по `storeDrinkOptions`, неизвестная связь становится своим напитком) или свой напиток только с `name`.

## Лента

- `/feed` — все стены одной лентой: те же записи `profileComment`, без отдельной таблицы и копий. Запись из ленты пишется на стену автора (`profileId = userId`), запись на любой стене сразу видна в ленте; удаление, реакции и комментарии общие. Не заводи для ленты отдельное хранилище — связь держится на том, что это одна строка.
- Запрос — `getFeed` в `profile-community.ts` (колонки общие со стеной, `WALL_POST_COLUMNS`); вкладка «Подписки» — свои записи и записи авторов/стен, на которые подписан зритель. Карточка записи — `WallPost` (`wall-post.tsx`) и на стене, и в ленте; в ленте показывает «на стене …», если запись на чужой стене.
- Правка: записи стены и комментарии (отзывы, тирлисты, стена) редактирует только автор; владелец стены может лишь удалить чужую запись. `editedAt` (миграция `0053`) показывает метку «изменено». Иконки действий — `action-icons.tsx`. Лайки комментариев стены — `wallReplyLike` (`0052`), свой комментарий лайкнуть нельзя.
- Ответы в обсуждениях (отзывы, тирлисты, стена): `replyToId` + `replyToUserId` (миграция `0055`). Адресата сервер берёт из комментария того же обсуждения, а не от клиента; ник адресата хранится отдельно и остаётся после удаления исходного комментария. Триггер `notify_comment_reply` шлёт уведомление `comment-reply`, кроме ответа самому себе и ответа автору отзыва (тот уже получает `review-comment`).
- Вложения стены (`wallPhoto`, миграция `0056`): `kind` image/gif/video. Тип определяется по содержимому (`prepareWallMedia` в `wall-media.ts`), а не по MIME браузера: GIF перекодируется в анимированный WebP, видео — только MP4/WebM (QuickTime отклоняется), одно на запись, до 20 МБ, с превью-кадром, снятым в браузере и перекодированным сервером. `/api/wall-photos/[id]` отдаёт видео по Range (Safari без этого не играет), `data` хранится с `storage external`, чтобы `substring` читал только нужный кусок. Лимит тела запроса — 26 МБ и в Next, и в `Caddyfile`; меняй их вместе.
- Страница импортирует `shared.css`, `profile.css` (стили записей стены) и `feed.css`. Иконка — три `.nav-icon-part`, анимация `tab-feed-post`/`tab-feed-push` в `globals.css`.

## Онлайн в админке

- «В сети сейчас» и график «Онлайн за сутки» считают по тому же правилу, что статус в профиле: heartbeat за 2 минуты, живая сессия, статус не скрыт. `touchPresence` одним запросом обновляет `lastSeenAt` и отмечает участника в 5-минутном окне `presenceSample` (миграция `0054`); график — пик таких окон по часам за 24 часа. Записи старше 8 дней удаляет запрос аналитики админки.

## Рамки аватарки

- Пресеты — `PROFILE_FRAMES` в `src/lib/profile-appearance.ts`, отрисовка — `src/components/avatar-frame.tsx` (SVG + CSS keyframes, без JS). Ключи стабильны: не переименовывай их, у пользователей они сохранены в БД.
- Новая рамка требует миграции, которая пересоздаёт check `user_profile_appearance` (см. `0049_profile_frames_abyss_nova.sql`), иначе сохранение упадёт с `23514`.
- Свечение (`filter: drop-shadow`) вешай на корневой `<svg>` или HTML-элемент: Safari игнорирует CSS-фильтры на вложенных SVG-элементах. Неоновые ободки (`.avatar-ring`) — HTML + `conic-gradient` + `mask`.
- Базовые стили — статичная поза для `prefers-reduced-motion` и закрытых вариантов в редакторе; временные элементы (блики, искры) по умолчанию `opacity: 0`.

## Уровень и таб бар

- Ранги уровня — `LEVEL_TIERS` в `src/lib/level-tier.ts` (Новичок 1, Бронза 3, Серебро 5, Золото 8, Платина 12, Легенда 20). `LevelEmblem` (панель опыта) и `LevelChip`/`profile-level` (строки авторов) в `src/components/level-badge.tsx`; палитра — CSS-переменные `[data-level-tier]` (не `data-tier`, чтобы не путать с тирлистами). `LevelEmblem` использует `useId` для градиентов: в тестовых обвязках рендерь несколько эмблем одним деревом. Панель опыта (`ProfileExperience expanded`) — эмблема, полоса уровня с концами «Ур. N → N+1», дорога рангов из `LEVEL_TIERS` (глифы `LevelTierGlyph`) и карточки статистики; `data-level-tier` стоит на самой секции, от него же тонированное свечение фона.
- Анимации иконок таб бара и хедера: `tap-motion.tsx` внутри `[data-motion-scope]` (`header`, `tab-bar`) ставит `data-activated` на нажатый `[data-motion]` и через `sessionStorage` продолжает анимацию с отрицательной `--tab-delay` на следующей странице (хедер и таб бар перемонтируются при навигации). Ключи анимаций — значения `data-motion` в `globals.css`.

## Календарь выпитого

- Таблица `drinkLog` (миграция `0059_drink_calendar.sql`): одна строка — одна банка, `day` — день по Москве. Напиток из каталога (`brand`/`flavor`, сервер сверяет со `storeDrinkOptions`, неизвестная пара становится своим напитком) или свой (`name`). `price` (копейки) и `store` необязательны и видны только владельцу — `getDrinkEntries(..., includePrivate)`.
- Логика: `src/lib/drink-calendar.ts` (БД) и `drink-calendar-fields.ts` (дни, серии, сетки, разбор формы). Серия — подряд идущие дни с отметкой; текущая жива, пока последний день — сегодня или вчера. Отмечать и удалять можно только сегодня/вчера (`DRINK_EDIT_WINDOW_DAYS`), до 10 банок в день.
- Опыт: `drink-day` — 10 XP за день (`sourceKey` = день), `drink-streak` — бонус за вехи 3/7/14/30 и далее каждые 30 дней (`sourceKey` = `<первый день серии>:<веха>`). Окно удаления не даёт сдвинуть первый день серии и получить бонус повторно — не расширяй его без смены ключа.
- Теги `drink-start`, `streak-7`, `streak-14`, `streak-30` (метрики `drinkLogs`, `drinkStreak`), арт — PNG из Figma (`570:3616`) в `public/brand/achievements`. Маскот — `DrinkBird` (`drink-bird.tsx`, векторы совы из Figma `635:2207` + CSS-анимации, настроения happy/waiting/sleepy; на тёмных темах — светлый контур, иначе чёрные крылья пропадают).
- Профиль: блок `calendar` (`DrinkCalendarBlock`, теплокарта за год), старые раскладки получают его сразу после уровня (`parseProfileLayout`). Страница — `/profile/[username]/calendar?month=YYYY-MM`. Тесты: `test/drink-calendar-fields.test.ts`, `test/drink-calendar.integration.test.ts`.

## Коллекция вкусов

- Своей таблицы нет: вкус считается попробованным, если у пользователя есть отзыв (`review`) или банка из каталога в `drinkLog`. Набор вкусов — `storeDrinkOptions` без «в ассортименте», бренды меньше чем с `MIN_COLLECTION_SIZE` вкусами не показываются, а попробованные вкусы, которых больше нет в каталоге, не считаются. Старые идентичности из отзывов приводятся через `canonicalDrink`.
- Линии со своим брендом в каталоге собираются вместе с основным брендом: `COLLECTION_BRAND_LINES` (Adrenaline Game Fuel → Adrenaline Rush, название с префиксом линии).
- Опыт: вехи 25/50/75/100% бренда (`COLLECTION_MILESTONES`), `reason='collection'`, `sourceKey` = `<бренд>:<процент>` — ключ по доле, а не по числу вкусов, поэтому рост каталога не платит повторно. У маленьких брендов доли, достигаемые одним и тем же числом вкусов, сливаются в старшую (`brandMilestones`). Начисляет `getBrandCollections` — при просмотре коллекции/профиля, после отзыва и после банки из каталога в календаре.
- Дубликаты вкусов в коллекции — почти всегда архивные идентичности из `product-registry.json` без предложений: у них то же фото, что у живого товара. Их склеивают алиасами в `REVIEWED_PRODUCT_ALIASES` + миграцией данных (`0060_archived_duplicate_aliases.sql`, переносит и `drinkLog`). Burn `peach` тоже такой дубль: на обложке архивной карточки банка «Персик Манго Zero Sugar», он склеен с `blend:mango+peach:sugarfree` (`0070`); обычного Burn с персиком нет. Если у склеиваемой карточки адрес с хэшем (не из `product-slugs.json`), добавь его в реестр со старой идентичностью — иначе после склейки он отдаст 404, а не 301.
- Логика — `src/lib/brand-collection-fields.ts` (чистая) и `brand-collection.ts` (БД), разметка — `src/components/brand-collection.tsx`, страница — `/profile/[username]/collection`, блок профиля `collection` (старые раскладки получают его сразу после календаря). Тесты: `test/brand-collection-fields.test.ts`, `test/brand-collection.integration.test.ts`, `test/archived-duplicate-alias-migration.integration.test.ts`.

## Топ месяца

- Гонка — XP, набранный за календарный месяц по Москве (без самих наградных XP). Итоги подводит идемпотентная `settle_monthly_top()` (миграция `0050_monthly_top.sql`), её вызывают главная и `/leaderboard` через `settleMonthlyTop()`; первый подсчёт — за октябрь 2026. Топ-3 получают +500/+300/+150 XP (`reason='monthly-top'`), достижение и тег `top` («ТОП», легендарный) и уведомление `monthly-top`.

## Теги за достижения

- `PROFILE_ACHIEVEMENTS` в `src/lib/profile-achievements.ts`: у тега `rarity` (common/rare/epic/legendary/special) и `steps` — тег выдаётся, только когда выполнены все шаги. Метрики — `ACHIEVEMENT_METRICS`, их считает один SQL в `getProfileCommunity` (`profile-community.ts`); новая метрика добавляется в оба места. «Развёрнутый отзыв» — от `DETAILED_REVIEW_CHARS` символов.
- Полученные теги лежат в `profileAchievement` навсегда: повышение порогов не отбирает старые теги. Не удаляй эти записи миграциями.
- Анимирован каждый тег, интенсивность по редкости (CSS в конце `globals.css`): обычные/особый — иконка с коротким акцентом, большую часть цикла в покое (`kitty` — ушки, `telegram` — самолётик); редкие — постоянный фон + акцент; эпические и легендарные — фирменный эффект (`burner` — огонь, `adrenaline` — ЭКГ, `deadinside` — глитч, `six-seven`/`top` — блеск). Новый тег обязан получить свой стиль там же. Иконки — SVG data URI через `--tag-icon` и `mask`. Эффекты — только `::before`/`::after` + transform/opacity/background-position, с отключением в `prefers-reduced-motion`. Теги рендерятся во многих списках (отзывы, стена, тирлисты) — не добавляй им JS и тяжёлых фильтров.
- Тест: `test/monthly-top.integration.test.ts` передаёт `settle_monthly_top(at)` с далёким будущим месяцем и удаляет только свою запись `monthlyTopSettlement`.

## Главная

- Порядок: первый экран `HomeHero` → бенто `HomeBento` (маркет, магазины и цены, отзывы; каждая плитка — одна ссылка с живыми данными) → рейтинг пользователей (только топ месяца, список «за всё время» — на `/leaderboard`) → тирлисты (горизонтальный скролл, до 8 + официальный) → «Топ-100 энергетиков» (одна полка с номерами мест) → «Объявления» (до 8 свежих из `getListings`, превью фото `?size=thumbnail`) → `TelegramPromo` → «Магазины на карте» (`HomeStoreMap`: опубликованные магазины города с точкой из `listStorePoints`, Яндекс Карты грузятся, только когда секция подходит к экрану). Базовые стили `.store-map*` лежат в `globals.css`, потому что карту рендерит и главная. Единственный `h1` страницы — видимый заголовок в `HomeHero`. Ссылка на канал — `TELEGRAM_CHANNEL_URL` в `telegram-promo.tsx`, её же использует футер.
- `HomeHero` (по мотивам Tailark hero-section-6) — серверный компонент на фоне страницы (`--color-surface`, без своей заливки): бейдж (лидер топа месяца или ссылка на цены), `h1`, поиск — обычная GET-форма на `/catalog?q=…`, список преимуществ с реальными числами (`getHomeCounts`). Сзади — карусель (`buildHomeHero` в `src/lib/home-hero.ts`): банки с фото, ценой и сетью вперемешку с отзывами (`getFeaturedReviews`), растушёвана градиентом к фону слева и снизу. Карусель — CSS-marquee из двух копий списка (вторая `aria-hidden` + `inert`), пауза при наведении/фокусе; при `prefers-reduced-motion` копия скрыта, лента листается вручную. Работает до гидратации.
- Фото товаров — JPEG на почти белом фоне: в карусели они лежат только на белых плитках с `mix-blend-mode: multiply`, лёгким `brightness` и радиальной `mask`. Не ставь фото прямо на фон страницы или цветную заливку — будет виден серый квадрат. Жёлтый в первом экране не используется: цена — синяя плашка, фокус — `--color-focus`.
- На мобильном полки напитков выходят к краям экрана и показывают ровно две карточки с краешком третьей.

## Экран загрузки

- Файлов `loading.tsx` и скелетонов нет намеренно: при переходе текущая страница остаётся на экране, а `NavigationProgressProvider` показывает `SiteLoading` (пиксельные буквы Canrush, CSS keyframes, без JavaScript) поверх, только если переход дольше `NAVIGATION_LOADING_DELAY_MS` (800 мс). Скелетоны пробовали и откатили: мигали на быстрых переходах, прятали фон темы профиля и зацикливали некоторые страницы профиля. Не возвращай их без отдельного решения.
- Геометрия и длительность цикла находятся в `src/lib/loading-word.ts`. Уважать `prefers-reduced-motion`. Анимация должна работать в потоковом fallback до гидратации страницы.

## Стили

- `src/app/globals.css` (корневой layout) блокирует первую отрисовку каждой страницы, поэтому в нём только общее: токены, базовые элементы, хедер, таб бар, футер, экран загрузки и всё, что рендерит главная. Стили одного раздела туда не добавляй.
- Стили разделов лежат в `src/styles/<раздел>.css`: `admin`, `auth` (`/sign-in`, `/auth/*`), `catalog`, `legal`, `market` (`/market/*` и `/messages/*`), `prices`, `profile`, `tierlists`. Правила, нужные нескольким разделам, но не главной, — в `src/styles/shared.css`. Каждый `page.tsx`/`error.tsx` раздела импортирует сначала `shared.css`, затем свой файл; новая страница раздела обязана импортировать оба.
- Файлы разделов грузятся после `globals.css`, поэтому при равной специфичности их правило побеждает глобальное, даже если в старом едином файле стояло выше. Часть правил разделов намеренно осталась в `globals.css`: они должны и дальше уступать более поздним глобальным правилам. Перенося правило, проверь, не перебьёт ли оно глобальное с той же специфичностью на том же элементе.
- Next не выгружает CSS при клиентских переходах, и файлы разных разделов могут одновременно оказаться на странице. Селекторы раздела опирай на классы самого раздела, а не на общие (`h2`, `.community-button` без родителя).

## Верификация перед завершением задачи

```bash
npm run build
npm run lint
npm test
npm -w apps/site run typecheck
npm -w apps/site run test:auth
```

Все три должны проходить без ошибок (warnings eslint допустимы).
