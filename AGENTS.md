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

Пищевая ценность (таурин, кофеин, КБЖУ): `npm -w apps/parser run ingredients:nutrition` → GigaChat
(`src/ingredients/gigachat.ts`, `nutrition.ts`) переносит числа из сохранённой страницы состава. Модели не доверяем:
`verifyNutrition` оставляет только число, стоящее вплотную к своей подписи в тексте, и в допустимом диапазоне
(`NUTRITION_RANGES` в `@canrush/shared`). Не ослабляй эту проверку и не проси модель «знать» состав без текста источника.
Ключ — `GIGACHAT_AUTH_KEY` в `apps/parser/.env`, сертификат Минцифры — только для запросов к GigaChat
(`certs/russian_trusted_root_ca.pem`). Блок «Пищевая ценность» на сайте временно скрыт (`SHOW_NUTRITION` в
`catalog-product-ingredients.tsx`): числа хранятся, но показываются только после ручной сверки — источник Red Bull
Original давал 250 мг таурина вместо 400.
Временно (до ручной сверки) составы и КБЖУ товаров без проверенной привязки берутся из карточек Лавки:
`npm -w apps/parser run ingredients:lavka` (`src/ingredients/lavka.ts`) → `status: unverified`, `nutrition.method: 'store'`.
«Краткий состав» Лавки сделан ИИ — не используй его; GigaChat для Лавки не нужен.
Последний вариант — `ingredients:ai`: GigaChat по памяти → `status: ai_generated` (без `sourceUrl`, с `model`), на сайте
плашка «Сгенерировано ИИ». Публикуется только перечень: числа модели (`method: 'ai'`) были шаблонными — не возвращай их без нового контроля. Записи с источником не могут нести `method: 'ai'` или `model`
(`isPublishedIngredients`). Перед массовым прогоном запускай `--control`: в октябре 2026 числа совпадали плохо.

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
  выпадающих меню `HeaderMenu` — «Сообщество» (Тирлисты, Объявления, Лента, Люди → `/community?type=people`, иконка `people`) и «Магазины»
  (Каталог, Цены, Найти → `/market/stores`) — и «Профиль». Подпись группы — ссылка на её первую
  страницу (`/tierlists`, `/catalog`), меню открывается наведением или кнопкой-стрелкой рядом. Таб бар — пять
  вкладок: Главная, «Календарь» (`/calendar` — редирект в свой календарь выпитого или на вход), «Поиск» (`/search`, круглая
  кнопка по центру), «Сообщество» (`/community`) и Профиль, а гостю — «Войти»
  (`/sign-in`). Вход определяется по наличию cookie сессии (`getSessionCookie`) в `ProfileNavigation`, поэтому
  она async; в тестах передавай `signedIn`. Каталог, цены, магазины и маркет подсвечивают «Поиск», тирлисты и лента —
  «Сообщество», свой календарь — «Календарь».
  Страницы `/market/stores*` передают `active="stores"`: в меню отмечается «Найти». Таб бар
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

## Android-приложение

- `apps/android` — оболочка Capacitor 8 (`ru.canrush.app`, ID после публикации не меняется). WebView грузит живой `https://canrush.ru` (`server.url`), статической сборки сайта нет: SSR, Server Actions и cookie Better Auth работают как в браузере, CSP и origin checks не трогай ради приложения. Публикация — сначала RuStore, Google Play позже. Подробности — `apps/android/README.md`.
- У workspace нет скриптов `build`/`test`/`lint`: корневые команды не требуют Java и Android SDK. Сборка — `npm -w apps/android run apk:debug`.
- `capacitor.config.ts` — источник правды, `android/app/src/main/assets/capacitor.config.json` генерируется `sync`. Иконки и заставка — `npm -w apps/android run icons` из `apps/site/src/app/icon.svg`, не правь PNG руками.
- App Links: intent-filter `canrush.ru` с `autoVerify`, `MainActivity` открывает ссылку в WebView. Без `/.well-known/assetlinks.json` с SHA-256 ключа подписи ссылки (и вход из письма) открываются в браузере.
- Ключи подписи (`*.jks`, `keystore.properties`) — только локально/в менеджере секретов.
- `/.well-known/assetlinks.json` (`src/app/.well-known/assetlinks.json/route.ts`) подтверждает App Links: SHA-256 релизного ключа (RuStore) зашит, ключ подписи Google Play добавляется в `ANDROID_APP_SHA256` (через запятую). Ответ — 200 без редиректов, иначе Android не подтвердит ссылки.
- `/account-deletion` — публичная страница удаления аккаунта для Google Play и RuStore; держи её в согласии с `deleteAccountAction` и каскадами БД (бот-чат `telegramChat` удаляется там же явно — он связан по Telegram id, а не по аккаунту). Политика (`/privacy`, раздел `mobile-app`) описывает push-токен, камеру, геолокацию и передачу в FCM/RuStore Push; у неё и страницы удаления своя дата редакции `privacyEffectiveDate` в `src/lib/legal.ts`.
- Заставка — фирменный синий `#006EFF` с белым знаком (`windowSplashScreen*` в `styles.xml`, `drawable/splash_icon.xml`, PNG для старых Android — `npm -w apps/android run icons`). Сайт прячет её сам, когда страница отрисована (`hideSplash` в `NativeAppShell`), `launchShowDuration` 3 с — предел; `offline.html` прячет её тоже. `NativeAppShell` (корневой layout) работает только в приложении: ставит `html[data-native-app]` и даёт pull-to-refresh — потянуть вниз в самом верху страницы → `router.refresh()` (данные сервера обновляются без перезагрузки, скролл и состояние остаются), индикатор — кольцо со знаком (стили `.pull-refresh` в `globals.css`). Жест не начинается в открытом `dialog`, на картах, в полях ввода, во внутренних прокрутках и при горизонтальном свайпе; элементу, внутри которого тянуть нельзя, ставь `data-no-pull`.
- Скриншоты (тирлисты, календарь выпитого) в приложении: WebView не скачивает blob-ссылку и не копирует картинку, поэтому `ScreenshotPreview` в приложении показывает «Сохранить в галерею» и «Поделиться» — PNG уходит base64 в `CanrushImagePlugin` (`nativeImage` в `native-app.ts`): MediaStore `Pictures/CanRush` (Android 10+) и системное меню через FileProvider. В старой версии приложения без модуля окно просит обновиться.
- В приложении футер сайта скрыт (`html[data-native-app] .brand-footer`): документы и связь (соглашение, политика, удаление аккаунта, почта, Telegram) — в настройках, группа «О CanRush» → «Документы и связь» (`AboutLinks` в `profile/settings/page.tsx`, у гостя — отдельной панелью). Магазины требуют, чтобы политика и удаление аккаунта были доступны в приложении: убирая ссылку из футера, оставляй её там. Футер раньше давал отступ под таб бар, поэтому в приложении `.main-surface` получает нижний отступ `--site-tab-bar-offset` + 32px.
- Быстрые действия на иконке — `res/xml/shortcuts.xml` (Отметить банку → `/calendar`, Поиск, Цены, Маркет): явный VIEW-интент на `MainActivity`, ссылку открывает `openSiteLink`. Иконки — векторы `drawable/shortcut_*.xml`.
- Жалобы на контент (требование Google Play к UGC): та же очередь `profileReport`, миграция `0084` добавила `contentKind`/`contentId`/`excerpt`/`pagePath`. Виды — `CONTENT_REPORT_KINDS` (`profile-report-fields.ts`), автор и снимок текста — `CONTENT_SOURCES` в `profile-reports.ts` (сообщение заказа — только участнику заказа). Кнопка — `ContentReportButton` (диалог причины), стоит у отзывов, комментариев, записей стены/ленты, тирлистов, объявлений, сообщений заказа и магазинов; лимит 10 жалоб в сутки общий с жалобами на профили. Новый вид контента — в check миграции, `CONTENT_REPORT_KINDS` и `CONTENT_SOURCES`. Тест: `test/profile-reports.integration.test.ts`.
- Блокировка участников друг другом — `memberBlock` (миграция `0086`), не путать с админским баном `userBlock`. Общение закрыто в обе стороны триггером `prevent_blocked_interaction` (стена, комментарии и ответы, подписки, заказы, сообщения заказа; ошибка `CR001` → `isMemberBlockedError`/`MEMBER_BLOCKED_MESSAGE` в catch действий), уведомления от заблокированного не создаются (`notification_member_block`, значит и push/Telegram). Заблокировавший не видит записи, комментарии, отзывы и rank-up заблокированного — условие `notBlockedBy(viewer, author)` в `getFeed`, `getProfileWall`, `get*Comments`, `getReviewsForProduct`; новый список с чужим контентом добавляй с ним же. Блокировка снимает подписки в обе стороны. UI — `BlockMemberButton`: в окне жалобы после отправки, на профиле, список в настройках (`/profile/settings?section=blocked`). Тест: `test/member-blocks.integration.test.ts`.
- Push Android-приложения: миграция `0085` — `pushDevice` (токен FCM/RuStore → участник) и `pushOutbox`; триггер `notification_push` зеркалит уведомления сайта, как `notification_telegram`, маркет — `enqueuePush` в `notifyMarket`. Отправитель — `src/lib/push/` (FCM HTTP v1 по сервисному аккаунту `FCM_SERVICE_ACCOUNT_FILE`, RuStore Push — `RUSTORE_PUSH_*`), воркер стартует в `instrumentation.ts` (`PUSH_WORKER=off`). Мёртвый токен (404/UNREGISTERED, 400 INVALID_ARGUMENT) удаляет устройство. RuStore Push — запасной провайдер для телефонов без сервисов Google: SDK в приложении, токен через `CanrushPush.rustoreToken()`, если FCM недоступен; нажатие — deep link `click_action` на `https://canrush.ru/…` (`click_action_type: 1`), FCM — `data.url` через Capacitor. В приложении `PushRegistration` (в `ProfileNavigation`) после входа спрашивает разрешение и шлёт токен server action-ом; выход отвязывает токен. Без `google-services.json` в сборке `CanrushPush.status()` возвращает `fcm: false`, и разрешение не спрашивается. Тест: `test/push.integration.test.ts` (fetch замокан).
- Вход проверяющего Google Play/RuStore (они не могут открыть magic link или Telegram): плагин `reviewLogin` (`src/lib/review-login.ts`, `POST /api/auth/review/sign-in`) пускает по паролю только аккаунт `REVIEW_LOGIN_EMAIL`; в окружении лежит лишь scrypt-хэш `REVIEW_LOGIN_PASSWORD_HASH` (`npm -w apps/site run review:password`), без обеих переменных — 404. 5 попыток за 15 минут на IP. Форма `ReviewSignIn` видна только в приложении. Не включай `emailAndPassword` Better Auth для остальных и не выдавай этому аккаунту админку. Тест: `test/review-login.integration.test.ts`.
- В приложении нет вкладок и `navigator.share`: `window.open` уходит во внешний браузер. Сайт проверяет приложение и вызывает нативные модули только через `src/lib/native-app.ts` (`isNativeApp`, `nativeShare`). Внешние ссылки оболочка сама отдаёт системе, страница остаётся; t.me на бота/канал `TelegramLinksPlugin` открывает сразу в Telegram (`tg://resolve`) — Telegram не из Google Play не закреплён за t.me, и Chrome уводил на telegram.org. Пока человек в Telegram, приложение свёрнуто и запросы страницы могут обрываться: опрос входа (`telegram-sign-in.tsx`) переживает сетевые ошибки и проверяет сразу при возврате (`visibilitychange`) — не возвращай остановку цикла на ошибке fetch. Выбор фото с камерой — `MediaChooserChromeClient` в оболочке, сайт ничего не делает.

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
- Мобильный таб-бар: Главная, Календарь, Поиск, Сообщество, Профиль/Войти. Хедер: меню «Сообщество» и «Магазины» и «Профиль».
- Поиск — `/search` (`src/app/search/page.tsx`, стили `search.css`): селекторы Каталог, Магазины и Маркет. Сообщество — `/community`: один закреплённый переключатель на всю ширину над всеми вкладками (поверхность `catalog-surface`, как у поиска), без строки поиска (ленты в сообществе нет — она на главной и на `/feed`; старая ссылка `/community?type=feed` ведёт на `/feed`): Тирлисты (`TierListsBrowser`, рендерит и `/tierlists`), Дейтинг (`DatingBrowser`, раздел «Дейтинг напитков») и Люди (`PeopleBrowser`: карточки с рамкой аватара, выбранным тегом — у «Двигателя» с номером, — описанием, уровнем, подписчиками, банками и щитом XP в цветах ранга; список самых активных из `profileRanking` через `searchPeople`; поля поиска нет, но `?q=` по-прежнему фильтрует по нику, имени и описанию). Поиск тирлистов остаётся над пользовательскими тирлистами. Сортировка каталога — в панели фильтров рядом с поиском, как у маркета. Каждый — полноценный раздел: `CatalogBrowser`, `StoreBrowser` (список/карта через `StoreDirectory`) и `MarketBrowser` — те же компоненты рендерят `/catalog`, `/market/stores` и `/market`. Они принимают `basePath` (куда ведут поиск, фильтры и страницы), `keep` (параметр `type`, который сохраняется) и `scopes` — переключатель, закреплённый вместе с формой раздела (`Pinned`, `search-pinned.tsx`). `position: sticky` работает, потому что у `html` и `body` `overflow-x: clip`, а не `hidden` — не возвращай `hidden`.
- Вкладки разделов — `src/components/section-tabs.tsx`: `MarketTabs` (Все объявления, Мои объявления, Заказы → `/messages`) и `StoreTabs` (Цены → `/prices`, Магазины и Мои магазины → `/market/stores`). URL не менялись; `/messages*` подсвечивают раздел `market`, `/market/stores*` — раздел `stores` (в таб баре это вкладка «Магазины», как и `prices`). Приватные вкладки скрыты для гостей.
- Браузерная проверка: `node apps/site/scripts/market-smoke.mjs`. Требует сборку и отдельный сервер на `localhost:3100` с `DATABASE_URL=postgresql://localhost:5432/canrush_site_test`, `BETTER_AUTH_URL=http://localhost:3100`, `BETTER_AUTH_SECRET=canrush-market-browser-test-secret-32-bytes` (фиктивный секрет только тестового сервера). Создаёт и очищает только собственные тестовые аккаунты, не отправляет письма.

## Магазины

- `/market/stores` (`src/lib/stores.ts`, `store-fields.ts`, `store-catalog.ts`), публичная страница — `/market/stores/[id]` (`getVisibleStore`: опубликован, или автор, или админ). Кнопка «Открыть в Яндекс Картах» (`store-route-button`) на компьютере стоит в шапке, а на телефоне (<640 px) плавает над таб баром и поднимается над плашкой cookie, пока та видна (`market.css`). Миграции `0036`, `0037`, `0058_store_locations.sql`.
- Точку задаёт адрес: форма геокодирует его через server action `geocodeStoreAction` → HTTP Геокодер (`store-geocoder.ts`) с отдельным ключом `YANDEX_GEOCODER_API_KEY` (только сервер, вход обязателен, до 20 запросов в минуту на аккаунт); без этого ключа — в браузере через `ymaps.geocode` с ключом карты. Координаты необязательны; поставленные вручную (клик по карте/поля) приоритетнее адреса — `locationSource` = `manual`/`geocoded`, у магазина без точки все три поля `null` (check `market_store_location`). Если геокодер недоступен, форма предлагает поставить точку вручную.
- Станции метро, МЦК и МЦД с координатами — статичный `src/lib/stores/metro.json` из открытого `api.hh.ru/metro`; обновление `npm -w apps/site run metro:update`. id станций хранятся в БД: скрипт сохраняет пропавшие из hh.ru станции. Если станция не выбрана, сервер подставляет ближайшую в пределах `NEAREST_METRO_KM`.
- Опыт за магазин: +75 XP (`STORE_XP` в `store-fields.ts`), когда магазин проходит модерацию — триггер `store_experience` на `marketStore` (миграция `0089`), `reason='store'`, `sourceKey` = id магазина: повторная модерация после правки не платит, удаление не отбирает, не больше 20 магазинов, заблокированным не начисляется. Меняя сумму или лимит, меняй `award_profile_experience` и `STORE_XP` вместе. Тест: `test/store-experience.integration.test.ts`.
- Напиток магазина — `{brand, flavor}` группы каталога (имя и ссылку на карточку сервер проверяет по `storeDrinkOptions`, неизвестная связь становится своим напитком) или свой напиток только с `name`.

## Напитки от участников

- `/catalog/new` — пошаговая заявка (`CatalogDrinkForm`, те же `store-form-progress`/`FormStep`, что у магазина): 1) бренд — `CatalogDrinkBrandInput`, поле с тем же выпадающим списком брендов каталога (свой бренд остаётся как введён), и вкус — одно текстовое поле `CatalogDrinkFlavorInput`: подсказки из `BASIC_FLAVORS` (`catalog-query.ts`) появляются только после ввода, «Добавить свой вкус «…»», выбранные — плашками через «+», как пишет сайт; до трёх, свои и из списка вперемешку (микс → `blend:` по алфавиту ключей, своё имя — частью ключа), плюс переключатель «без сахара» (`:sugarfree`); 2) одно фото банки (обложка в каталоге); 3) объёмы (100–2000 мл, до 6) и состав с этикетки (необязательно, до 1500 символов); 4) превью карточки. Ключ вкуса — та же идентичность, что у групп парсера, поэтому `flavorName` показывает своё название как есть, а отзывы, избранное, календарь, тирлисты и дейтинг работают без доработок. Правила полей — `catalog-drink-fields.ts` (общие для браузера и сервера), под формой — «Ваши заявки» со статусом и причиной отказа.
- Таблица `catalogDrink` (миграция `0094_catalog_drinks.sql`, фото `storage external`): `pending` → `published`/`rejected`, как у магазинов; уникальность `(lower(brand), lower(flavor))` среди неотклонённых. `submitCatalogDrink` (`catalog-drinks.ts`) берёт написание бренда из каталога, приводит вкус через `reviewedProductIdentity`/`canonicalProductFlavor` и отказывает, если такой напиток уже есть (в файлах парсера или опубликован; ошибка `CatalogDrinkDuplicate` со ссылкой на карточку); до 10 заявок на проверке и не чаще раза в минуту, заблокированным нельзя. Модерация — `/admin/drinks` (раздел «Напитки» рядом с «Магазинами»), отказ требует причину.
- Опубликованные напитки входят в `loadAllCatalogGroups` (`catalogDrinkGroups`: без предложений, обложка `/api/catalog-drinks/<id>` — публичная после публикации, до неё только автору и админам); группа из файлов парсера с той же идентичностью важнее. В каталоге они идут блоком «Добавлены участниками» после напитков с ценами (без поиска тоже), архив — по-прежнему только при поиске. Форма открывается кнопкой «+» справа от фильтров каталога (`CatalogControls addHref`, `.catalog-add-button`), на телефоне и на компьютере. Пока у напитка нет предложений, его страница показывает под названием плашки «От участника» и объёмы, вместо цен — пустое состояние с кнопкой «Добавить магазин» (история цен скрыта), а в конце, на обеих вкладках, — карточку автора `CatalogDrinkAuthor` (аватар, тег, XP, дата и сколько его напитков в каталоге — `author.drinks`); состав без файла ингредиентов — из заявки (`catalogDrinkIngredients`, `status: 'unverified'`). Опыта за напиток нет. Тесты: `test/catalog-drink-fields.test.ts`, `test/catalog-drinks.integration.test.ts`.

## Лента

- `/feed` — все стены одной лентой: те же записи `profileComment`, без отдельной таблицы и копий. Запись из ленты пишется на стену автора (`profileId = userId`), запись на любой стене сразу видна в ленте; удаление, реакции и комментарии общие. Не заводи для ленты отдельное хранилище — связь держится на том, что это одна строка.
- Запрос — `getFeed` в `profile-community.ts` (колонки общие со стеной, `WALL_POST_COLUMNS`); вкладка «Подписки» — свои записи и записи авторов/стен, на которые подписан зритель. Карточка записи — `WallPost` (`wall-post.tsx`) и на стене, и в ленте; в ленте показывает «на стене …», если запись на чужой стене.
- Правка: записи стены и комментарии (отзывы, тирлисты, стена) редактирует только автор; владелец стены может лишь удалить чужую запись. `editedAt` (миграция `0053`) показывает метку «изменено». Иконки действий — `action-icons.tsx`. Лайки комментариев стены — `wallReplyLike` (`0052`), свой комментарий лайкнуть нельзя.
- Ответы в обсуждениях (отзывы, тирлисты, стена): `replyToId` + `replyToUserId` (миграция `0055`). Адресата сервер берёт из комментария того же обсуждения, а не от клиента; ник адресата хранится отдельно и остаётся после удаления исходного комментария. Триггер `notify_comment_reply` шлёт уведомление `comment-reply`, кроме ответа самому себе и ответа автору отзыва (тот уже получает `review-comment`).
- Вложения в комментариях (отзывы, тирлисты, стена) — по правилам записей стены: до 5 фото/GIF и одно видео, та же `prepareWallMedia`. Таблица `commentMedia` (миграция `0077`) с тремя FK на таблицы комментариев (ровно один заполнен, удаляются вместе с комментарием), отдаётся через `/api/comment-media/[id]` — общий `serveStoredMedia` с `/api/wall-photos` (Range для видео). С вложениями комментарий уходит в server action как FormData (`text`, `replyToId`, `photos`, `videoPoster`), без них — как раньше. Выбор, проверка и превью вложений — общий `useMediaAttachments` (`media-attachments.tsx`) у стены и комментариев. Комментарий или запись могут быть только вложением без текста (миграция `0078`: CHECK текста — лишь до 1000 символов, а «текст или вложение» проверяет отложенный constraint-триггер `require_text_or_media` при коммите, потому что вложения вставляются после строки). Правка текста по-прежнему требует текст.
- Вставка из буфера обмена (`pastedFiles`, `src/lib/clipboard-files.ts`): в полях стены и комментариев вставленные картинки и видео становятся вложениями, в форме отзыва — фото отзыва, `MarketPhotoPicker` (объявления, магазины, чат) ловит вставку картинки на всей странице. Обычный текст вставляется как обычно.
- Упоминания `@ник` в комментариях (отзывы, тирлисты, стена) и записях стены/ленты: `MentionText` подсвечивает их ссылкой на профиль, `MentionTextarea` подсказывает ники при вводе (`/api/mentions`, только для вошедших, по префиксу). Правило «@ не внутри слова, почты или ссылки» общее для сайта (`src/lib/mentions.ts`) и БД: триггер `notify_mentions` (миграция `0076`) шлёт уведомление `mention` (не автору, не адресату ответа, не владельцу отзыва/стены — они получают своё), ключ `mention:<таблица>:<id>:<user>`, поэтому правка уведомляет только новых упомянутых. Меняя правило, меняй его в обоих местах.
- Вложения стены (`wallPhoto`, миграция `0056`): `kind` image/gif/video. Тип определяется по содержимому (`prepareWallMedia` в `wall-media.ts`), а не по MIME браузера: GIF перекодируется в анимированный WebP, видео — только MP4/WebM (QuickTime отклоняется), одно на запись, до 20 МБ, с превью-кадром, снятым в браузере и перекодированным сервером. `/api/wall-photos/[id]` отдаёт видео по Range (Safari без этого не играет), `data` хранится с `storage external`, чтобы `substring` читал только нужный кусок. Лимит тела запроса — 26 МБ и в Next, и в `Caddyfile`; меняй их вместе.
- Повышение ранга в ленте: таблица `rankUp` (миграции `0079_rank_up_feed.sql`, `0080_rank_degrees.sql`), одна строка на участника, ранг и степень: Золото и Платина объявляются один раз (степень 1), Легенда — каждая степень. Её пишет триггер `rank_up` на вставку в `profileExperience` — через неё проходят все начисления XP; при прыжке через несколько рангов объявляется только старший. SQL `experience_level()` и `rank_up_step()` повторяют `experienceLevel` и `LEVEL_TIERS`: меняя формулу, пороги рангов или `LEGEND_DEGREE_STEP`, меняй и их (сверяет `test/rank-up.integration.test.ts`). `getFeed` сливает записи и события одним `union all` и отдаёт `items`; карточка — `RankUpCard` (`rank-up-card.tsx`, стили в `feed.css`, эффект нарастает от Золота к Легенде, тёмные темы сайта учтены). Заблокированные и участники без ника в ленту не попадают.
- События в ленте, кроме ранга: опубликованный тирлист (`kind: 'tierlist'`, по `publishedAt`, карточка — та же `TierListCard` с лайками) и оценки напитков (`kind: 'reviews'`): все отзывы одного участника за московский день — одно событие с ключом `<userId>|<YYYY-MM-DD>` (`getReviewsByAuthorDays` в `reviews.ts`), чтобы серия отзывов не забивала ленту; в карточке видна одна оценка в стиле сайта (фото банки на всю высоту, бренд серым чипом, оценка синей «таблеткой» со звездой, дизайн/вкус, три строки текста), ссылка на отзыв; остальные отзывы того дня (они уже загружены с карточкой) лежат «стопкой» — под карточкой выглядывают края одной-двух следующих (`.feed-reviews-stack`); стопка или кнопка «Посмотреть больше · ещё N» раскрывает их на месте, «Свернуть» собирает обратно (`FeedReviewsMore`, `feed-reviews-more.tsx`, `REVIEWS_SHOWN` = 1), лайки подгружаются для всех; у каждого напитка сердце в правом верхнем углу — лайк отзыва прямо из ленты (`TierLikeButton kind="review"` → `reviewDiscussionAction(id, 'vote')`, свой отзыв — только счётчик). Разметка — `feed-activity.tsx`, стили — `.feed-event`/`.feed-review` в `feed.css`. Условия для авторов событий общие (`FEED_EVENT_AUTHOR`): ник, не заблокирован, не заблокирован зрителем, «Подписки» — свои и подписок; в «Сохранённых» событий нет. Тест: `test/feed-events.integration.test.ts`.
- Страница импортирует `shared.css`, `profile.css` (стили записей стены) и `feed.css`. Иконка — три `.nav-icon-part`, анимация `tab-feed-post`/`tab-feed-push` в `globals.css`.

## Вид записей и навигации

- Хедер лежит на нейтральной подложке темы (`--color-subtle`), а не на фирменном синем; поверхность страницы скруглена сверху поверх неё. Знак — `logo-mark.svg` маской с `--color-brand`, надпись — маской с `--color-ink` (`.brand-mark`/`.brand-wordmark` — `span`, не `img`). Правила — последний блок `site-theme.css`, чтобы перекрыть тематические.
- Переключатели и вкладки разделов — круглые таблетки: `.search-scopes` (поиск, сообщество; на телефоне без иконок) и `.market-filters` (лента, маркет, магазины), выбранная залита `--color-brand`.
- Записи ленты — строки с разделителями, без карточек (`feed.css`); карточками остаются только события ранга. Реакции (`ReviewDiscussion`) — иконка + число без подложек: лайк — красное сердце (`.review-like`), у комментариев только число.
- Действия с записью, отзывом и комментарием (редактировать, удалить, пожаловаться) — в меню «⋯» `MoreActions` (`more-actions.tsx`): пункты — кнопки `.more-actions-item` (`role="menuitem"`, опасные — `.is-danger`), меню закрывается по выбору, Escape и касанию вне. Панель остаётся в DOM скрытой (форма удаления внутри отправляется), поэтому диалоги из меню рендерятся порталом в `body` (`ContentReportButton variant="menuitem"`, `DeleteWallComment variant="menuitem"`).
- Успех действий сообщества (запись опубликована, удалена, подписка) — всплывающий тост `ActionToast` (`action-toast.tsx`, стили `.action-toast` в `globals.css`): поднимается над таб баром (и над плашкой cookie, пока она видна), галочка дорисовывается, через 2,6 с тост тает; `trigger` — объект состояния действия, поэтому одинаковый текст показывается снова. Ошибки (например пауза 30 секунд между записями) — тот же тост с `tone="error"`: оранжевый «!», `role="alert"`, держится дольше; введённый текст при этом остаётся в поле.
- Поля комментария и записи — `.review-text-composer` на `--color-subtle`: значок вложения и счётчик символов внутри поля (`.review-composer-toolbar`, `.review-composer-count`), кнопка «Отправить» — `.review-composer-submit`, на телефоне во всю ширину. Пустые комментарии — `.review-thread-empty` со значком и подсказкой.
- Закладки записей стены/ленты: `savedPost` (миграция `0087`), `setWallSaved`, `WallInteraction.saved`, действие `save` в `wallDiscussionAction`; кнопка-закладка справа в реакциях записи для вошедших, список — вкладка «Сохранённые» в `/feed` (`FeedScope 'saved'`, без событий ранга). Тест: `test/saved-posts.integration.test.ts`.

## Профиль и настройки

- Одна страница `/profile/settings` (шестерёнка в хедере): `ProfileEditForm` — островки строк (`profile-hub-island`), каждая открывает свою панель через `?section=` (жест «назад» возвращает к списку). Профиль (имя, Telegram-ссылки, тег), внешний вид, затем «Настройки» (тема, уведомления, вход и бот Telegram, заблокированные) и «Аккаунт» (почта, удаление). Панели настроек передаёт сервер (`settings`, `accountRows`), они рендерятся вне формы профиля со своими формами; превью профиля и панель сохранения для них скрыты. Действия настроек редиректят обратно с `section`. Кнопки «Редактировать профиль» нет, `/profile/edit` редиректит в настройки с тем же `section`. Тест: `test/profile-settings-hub.test.tsx`.

## Профиль: описание и баннер

- Описание — колонка `user.bio` (миграция `0074_profile_bio.sql`, до 160 символов, одна строка: переносы и пробелы схлопываются в `validateProfileInput`). Поле в «Данных» редактора; форма без поля `bio` его не трогает (`ProfileInput.bio` undefined). На профиле — отдельный блок «О себе» под плитками активности (в превью редактора — под ником в `ProfileHeader`), а также в поиске участников. Уровень профиля — чип на аватарке (`ProfileHeader level`), счётчики подписчиков и подписок — только на странице связей (`/connections`), на профиле остаются друзья.
- Баннер профиля — во всю ширину поверхности страницы и вплотную к её скруглённому верху: `profile.css` обнуляет верхний отступ `.main-surface`, у которой прямой потомок — `.community-profile` с шапкой, и выводит `.community-cover` за колонку через `calc(50% - 50vw)`. Свой баннер — высотой `clamp(120px, 25vw, 360px)` с `object-fit: cover`.

## Онлайн в админке

- «В сети сейчас» и график «Онлайн за сутки» считают по тому же правилу, что статус в профиле: heartbeat за 2 минуты, живая сессия, статус не скрыт. `touchPresence` одним запросом обновляет `lastSeenAt` и отмечает участника в 5-минутном окне `presenceSample` (миграция `0054`); график — пик таких окон по часам за 24 часа. Записи старше 8 дней удаляет запрос аналитики админки.

## Темы профиля

- Пресеты — `PROFILE_THEMES` в `src/lib/profile-appearance.ts`: тема на каждом шаге до Легенды (1, 2, 4, 6, 8 Золото, 10 Глубина, 12 Платина, 15 Кобальт, 18 Пламя, 20 Легенда). Ключи стабильны (хранятся в БД); новая тема требует миграции, пересоздающей check `user_profile_appearance` (`0083_profile_themes_to_legend.sql`).
- Поверхность профиля рендери через `profileThemeAttributes(theme)`: он ставит `data-profile-theme` и `data-profile-tone` (`light`/`dark`, у `default` нет — она следует теме сайта). Правки контраста для тёмных/светлых тем пиши через `[data-profile-tone=…]`, а не через имя темы. Палитра — `--profile-*` в `globals.css`, плюс строка `--profile-page` для фона страницы. Без неона, градиентов и переливов в темах (анти-референсы PRODUCT.md): баннер — один сплошной цвет, а характер темы — в палитре.
- Редактор оформления (`profile-appearance-editor.tsx`): островок уровня (эмблема, XP до следующего уровня, что откроется дальше — `nextAppearanceUnlock`, порог XP — `experienceForLevel`) и по выпадающему списку на темы и рамки (popover, разделы «Доступно»/«Откроется позже», стрелки/Home/End). Позиционирование popover — общий хук `useAnchoredPopover` (им же пользуется выбор тега). Тест — `test/profile-appearance-editor.test.tsx`.

## Рамки аватарки

- Пресеты — `PROFILE_FRAMES` в `src/lib/profile-appearance.ts`, отрисовка — `src/components/avatar-frame.tsx` (SVG + CSS keyframes, без JS). Ключи стабильны: не переименовывай их, у пользователей они сохранены в БД.
- Массивные рамки (ур. 10–20: Иней, Огненное кольцо, Жидкая энергия, Холодная банка, Корона Легенды) — `avatar-frame-heavy.tsx`, список `HEAVY_FRAMES`. Рисуются в 160% от аватарки (`viewBox="-30 -30 160 160"`, аватарка — круг r=50 в центре), задний слой (`avatar-frame-back`, языки пламени) — под фото. Все вычисленные координаты округляй через `round`/`polar`: тригонометрия Node и браузера расходится в последних знаках → ошибка гидрации (это ловит `test/avatar-frame.test.tsx`). Шум — целочисленный `noise`, не `Math.random`. Id градиентов — через `useId` (на странице несколько аватарок, часть в скрытых панелях).
- Новая рамка требует миграции, которая пересоздаёт check `user_profile_appearance` (см. `0049_profile_frames_abyss_nova.sql`), иначе сохранение упадёт с `23514`.
- Свечение (`filter: drop-shadow`) вешай на корневой `<svg>` или HTML-элемент: Safari игнорирует CSS-фильтры на вложенных SVG-элементах. Неоновые ободки (`.avatar-ring`) — HTML + `conic-gradient` + `mask`.
- Базовые стили — статичная поза для `prefers-reduced-motion` и закрытых вариантов в редакторе; временные элементы (блики, искры) по умолчанию `opacity: 0`.

## Уровень и таб бар

- Ранги уровня — `LEVEL_TIERS` в `src/lib/level-tier.ts` (Новичок 1, Бронза 3, Серебро 5, Золото 8, Платина 12, Легенда 20). У рангов есть степени (`degrees` — уровень начала каждой: Бронза I–II, Серебро I–III, Золото I–III, Платина I–III на 12/15/18), у Легенды — новая степень каждые `LEGEND_DEGREE_STEP` (5) уровней без потолка. Название «Серебро II» — `levelRank`, ближайшая цель — `nextLevelRank`; степень — ленточка с римской цифрой на `LevelEmblem` и шкала `experience-degrees` в панели опыта. `LevelEmblem` (панель опыта) и `LevelChip`/`profile-level` (строки авторов) в `src/components/level-badge.tsx`; палитра — CSS-переменные `[data-level-tier]` (не `data-tier`, чтобы не путать с тирлистами). `LevelEmblem` использует `useId` для градиентов: в тестовых обвязках рендерь несколько эмблем одним деревом. Панель опыта (`ProfileExperience expanded`) — эмблема, полоса уровня с концами «Ур. N → N+1», дорога рангов из `LEVEL_TIERS` (глифы `LevelTierGlyph`) и карточки статистики; `data-level-tier` стоит на самой секции, от него же тонированное свечение фона. Эмблема и глифы рангов — металлическая фигура цвета ранга, у каждого ранга своя (`SHAPES` в `level-badge.tsx`: шестиугольник, щит, 8-, 10- и 6-лучевые звёзды, у Легенды 16-лучевая); эффекты нарастают с рангом (`AURA`, `TWINKLE_COUNT`: блик с Бронзы, искры с Серебра, аура и пульс с Золота); `LevelEmblem wings` добавляет молнии по бокам (панель опыта). Панель показывает карточки статистики (достижения, место, % позади, уровни до следующей степени) и «Награды за уровень N» — `nextLevelRewards` (`src/lib/level-rewards.ts`): ранг/степень, пост в ленте по правилам `rank_up`, темы и рамки из `PROFILE_THEMES`/`PROFILE_FRAMES`; новая награда за уровень добавляется туда же. Тест: `test/level-rewards.test.ts`.
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
- Опыт: вехи 25/50/75/100% бренда (`COLLECTION_MILESTONES`), `reason='collection'`, `sourceKey` = `<бренд>:<процент>` — ключ по доле, а не по числу вкусов, поэтому рост каталога не платит повторно. У маленьких брендов доли, достигаемые одним и тем же числом вкусов, сливаются в старшую (`brandMilestones`). Подсказка «Ещё N до X%» берёт уже выплаченные доли из журнала опыта (`BrandCollection.paid`, `paidShares`): если каталог вырос после 100% (3/3 → 3/4), 100% не обещаются повторно, 75% доплачиваются, а заголовок пишет «бонусы уже получены». Начисляет `getBrandCollections` — при просмотре коллекции/профиля, после отзыва и после банки из каталога в календаре.
- Дубликаты вкусов в коллекции — почти всегда архивные идентичности из `product-registry.json` без предложений: у них то же фото, что у живого товара. Их склеивают алиасами в `REVIEWED_PRODUCT_ALIASES` + миграцией данных (`0060_archived_duplicate_aliases.sql`, переносит и `drinkLog`). Burn `peach` тоже такой дубль: на обложке архивной карточки банка «Персик Манго Zero Sugar», он склеен с `blend:mango+peach:sugarfree` (`0070`); обычного Burn с персиком нет. По жалобам участников так же склеены (`0075`): Lit Energy «Ягодный» → Classic (`original`), Flash Up «Барбарис» → Ultra, Pulseup «Вкус не уточнён» → Your Energy и «Pulse Up» Ягодный → Pulseup. Бренд «Pulse Up» парсер теперь сам приводит к Pulseup (бренд в `config/products.json`). Так же (`0082`): Flash Up «Манго» (старый дизайн) → манго-ананас, Ninja «Персик»/«Вишня» → Ninja Star (Едадил давал бренд «Ninja»; сам Ninja — это только «THE NINJA» Cheerio 250 мл), а «Adrenaline Game Fuel» Манго → Adrenaline Rush `mango`: манго перешёл из Game Fuel в Vitamin Power, в магазинах продаётся под обоими названиями. Если у склеиваемой карточки адрес с хэшем (не из `product-slugs.json`), добавь его в реестр со старой идентичностью — иначе после склейки он отдаст 404, а не 301.
- Логика — `src/lib/brand-collection-fields.ts` (чистая) и `brand-collection.ts` (БД), разметка — `src/components/brand-collection.tsx`, страница — `/profile/[username]/collection`, блок профиля `collection` (старые раскладки получают его сразу после календаря). Тесты: `test/brand-collection-fields.test.ts`, `test/brand-collection.integration.test.ts`, `test/archived-duplicate-alias-migration.integration.test.ts`.

## Конкурсы

- Реестр — `CONTESTS` в `src/lib/contest.ts`: ключ (пишется в `contestDraw.contest` и в URL админки), приз, тексты баннера, картинка, дни приёма (`firstDay`/`lastDay` по Москве, банка в календаре выпитого в эти дни — участие), день итогов и секретный тег победителя. Новый конкурс — новая запись; ключ потом не меняй. Фазы `upcoming` → `open` → `results` → `over`; `currentContest` выбирает самый ранний идущий: на главной он — короткий баннер в `HomeEvents`, а `ContestBanner` — шапка `/contest` (правила). У вошедшего баннер показывает свой чек-лист и следующий шаг, у гостя — «Войти и участвовать».
- Обязательна только банка; Telegram (`telegramUsername` или привязанный аккаунт) и аватар — желательны и в админке включаются фильтрами пула. Админы и заблокированные не участвуют.
- Админка: `/admin/contest` — карточки всех конкурсов, `/admin/contest/[key]` — участники и розыгрыш (`contest-db.ts`). Розыгрыш доступен только после конца приёма, `crypto.randomInt` по пулу; в `contestDraw` (миграция `0072`) сохраняются победитель, id пула и фильтры, всё пишется в `adminAuditLog`. Статусы: `pending` (ждём ответа) → `confirmed` (связались, выдаётся тег) или `unreachable` (не ответил — сразу новый розыгрыш с теми же фильтрами, а все `unreachable` этого конкурса из пула исключаются). Открытый победитель у конкурса один (частичный уникальный индекс + advisory lock).
- Тег `energizer` («Энерджайзер», `special`) выдаёт только подтверждение победителя; метрика `contestWin` лишь отражает выданный тег. Секретные теги видны только админам и получившим (`visibleProfileAchievements(viewerIsAdmin, earned)`). Тесты: `test/contest.test.ts`, `test/contest.integration.test.ts`.

## Двигатель беты

- Первые 500 участников получают личный номер и тег `engine` («Двигатель», `special`). Номера выдаёт триггер `beta_engine_member` на вставку в `user` через `assign_beta_engine` (миграция `0073_beta_engine.sql`, advisory lock против гонки); существующие участники пронумерованы по `createdAt`. Номер не переиспользуется: при удалении аккаунта строка `betaEngine` остаётся с `userId = null`, поэтому счётчик только растёт.
- Короткий баннер «Двигателя» в `HomeEvents` (`src/components/home-events.tsx`, данные — `getBetaEngine` в `src/lib/beta-engine.ts`) стоит на главной рядом с конкурсом и пропадает, когда все 500 мест заняты; он ведёт на `/engine` — полный баннер `BetaEngineBanner` (стили `src/styles/engine.css`) и правила. Метрика `betaEngine` лишь отражает строку `betaEngine`; на странице достижений тег не показывается закрытым. Тест: `test/beta-engine.integration.test.ts`.

## Топ месяца

- Гонка — XP, набранный за календарный месяц по Москве (без самих наградных XP). Итоги подводит идемпотентная `settle_monthly_top()` (миграция `0050_monthly_top.sql`), её вызывают главная и `/leaderboard` через `settleMonthlyTop()`; первый подсчёт — за октябрь 2026. Топ-3 получают +500/+300/+150 XP (`reason='monthly-top'`), достижение и тег `top` («ТОП», легендарный) и уведомление `monthly-top`.

## Теги за достижения

- `PROFILE_ACHIEVEMENTS` в `src/lib/profile-achievements.ts`: у тега `rarity` (common/rare/epic/legendary/special) и `steps` — тег выдаётся, только когда выполнены все шаги. Метрики — `ACHIEVEMENT_METRICS`, их считает один SQL в `getProfileCommunity` (`profile-community.ts`); новая метрика добавляется в оба места. «Развёрнутый отзыв» — от `DETAILED_REVIEW_CHARS` символов.
- Полученные теги лежат в `profileAchievement` навсегда: повышение порогов не отбирает старые теги. Не удаляй эти записи миграциями.
- Анимирован каждый тег, интенсивность по редкости (CSS в конце `globals.css`): обычные/особый — иконка с коротким акцентом, большую часть цикла в покое (`kitty` — ушки, `telegram` — самолётик); редкие — постоянный фон + акцент; эпические и легендарные — фирменный эффект (`burner` — огонь, `adrenaline` — ЭКГ, `deadinside` — глитч, `six-seven`/`top` — блеск). Новый тег обязан получить свой стиль там же. Иконки — SVG data URI через `--tag-icon` и `mask`. Эффекты — только `::before`/`::after` + transform/opacity/background-position, с отключением в `prefers-reduced-motion`. Теги рендерятся во многих списках (отзывы, стена, тирлисты) — не добавляй им JS и тяжёлых фильтров.
- «Монстр» (`monster`, эпический: 3 отзыва на Monster, 3 развёрнутых), «Фан» (`fan`, редкий: `FAN_WEEKLY_XP` за любые 7 дней подряд) и «Шоппер» (`shopper`, обычный: магазин прошёл модерацию, `marketStore.status = 'published'`) — миграция `0081`, она же разрешает теги и платит за них обычные 20 XP. «Фан» считает лучшее окно в 7 дней по `profileExperience` без наград `monthly-top` и `achievement` и только с `FAN_XP_SINCE`: старый опыт местами записан пачкой одним моментом (бэкфиллы), и без отсечки окно отдало бы тег всем ветеранам. Тест: `test/new-achievements.integration.test.ts`.
- Тест: `test/monthly-top.integration.test.ts` передаёт `settle_monthly_top(at)` с далёким будущим месяцем и удаляет только свою запись `monthlyTopSettlement`.

## Истории

- Ряд кружков в самом верху главной (`HomeStories` → клиентский `StoriesStrip` в `stories-strip.tsx`, стили `src/styles/stories.css`, их импортирует только главная). Порядок: «Добавить»/свои истории (кольцо горит, пока история жива), личные «Твоя неделя» и «Тебе понравится», «NRJ PARTY» для всех — история партнёра (`PartnerCard`: логотип, описание, Telegram и TikTok из `NRJ_PARTY`), её ключ `nrj:<понедельник недели по Москве>`, поэтому каждый понедельник кольцо загорается снова; «Telegram» для всех (и гостей): два слайда `PromoCard` — канал и бот со ссылками `TELEGRAM_CHANNEL_URL`/`TELEGRAM_BOT_URL` из `telegram-promo.tsx`, на слайде бота — пункт и главная кнопка Mini App (`miniAppUrl` из `getTelegramEnv`; без настроенного бота остаётся только «Открыть бота»); ключ `telegram:v1` — новая кампания меняет версию, и кольцо снова загорается; затем истории участников (непросмотренные и подписки раньше).
- Истории участников: таблица `story` (миграция `0090_stories.sql`) — одно фото, GIF или видео по правилам вложений стены (`prepareWallMedia`) и подпись до 200 символов; живут `STORY_HOURS` (24 ч, фильтр в запросах), строки старше недели удаляются при следующей публикации, до `MAX_STORIES_PER_DAY` за сутки, нужен ник, заблокированные не публикуют и не показываются (`src/lib/stories.ts`, константы — `story-limits.ts`, клиенту можно импортировать только их). Медиа — `/api/story-media/[id]` (`serveStoredMedia`, Range для видео) только пока история активна. Просмотры — `storyView`, гасят кольцо. Лайки — `storyLike` (миграция `0093_story_likes.sql`, `setStoryLike`/`likeStoryAction`): сердце внизу справа рядом с подписью, одно на человека, своё нельзя, при блокировке в любую сторону и у заблокированных — нет; автор вместо сердца видит лайки и просмотры, по нажатию — список лайкнувших (`getStoryLikers`, только автору). Уведомлений о лайках историй пока нет. Автор удаляет свою историю в «⋯», остальные жалуются (`CONTENT_REPORT_KINDS.story`). Заблокированный участником автор ему не показывается (`notBlockedBy`).
- «Твоя неделя» (`getWeeklyDigest` в `story-digest.ts`) и «Тебе понравится» (`getRecommendations`) не хранятся, а собираются на лету для вошедшего. Неделя — последние 7 дней по Москве: банки (и по дням, `daily`), серия, XP, отзывы, новые вкусы, место в рейтинге, вкус недели и `ahead` — какой доле отмечавших на этой неделе ты обошёл по банкам. Подача — как Spotify Wrapped (`DigestPage`: вступление, банки со столбиками дней, вкус недели с обложкой, прогресс, открытия, итоговая карточка; классы `.wrap*` в `stories.css`: свой цвет на слайд, плывущие фигуры, строки въезжают по `--line`); на светлых слайдах `data-tone=light` делает шапку тёмной. Пустая неделя — один слайд «Тихая неделя». Рекомендации — гибридная модель `rankRecommendations` (`story-recommendations.ts`, чистая): мнения каждого участника в [-1, 1] (оценка вкуса наполовину абсолютная, наполовину относительно его собственной средней; избранное ≥ 0,8; банки календаря — 3+ раза 0,7, 2 раза 0,5, одна — «пробовал» 0,2); похожесть — косинус мнений по общим напиткам с затуханием при малом пересечении плюс общие любимые бренды, соседи — выше 0,15, не больше 25; предсказание соседей с доверием по числу мнений (70%) + собственная тяга к бренду, семействам вкусов (`tasteTokens` из `profile-compatibility.ts`) и zero sugar (30%), +0,05 за наличие в магазинах, не больше двух напитков бренда; у каждого пункта объяснение (`similar`/`brand`/`flavor`). Кандидаты — до 60 участников с ≥2 общими напитками (избранное, отзывы, календарь), только неиспробованное и только из каталога города; меньше трёх — «Популярно у сообщества». Просмотр системных историй помнит браузер (`localStorage`). Тесты: `test/story-recommendations.test.ts`, `test/stories.integration.test.ts`.
- «Поделиться» в шапке просмотрщика: «Твоя неделя» уходит картинкой 1080×1920 (`renderWeekShare` в `week-share-image.ts`, canvas в цветах слайдов) — в приложении через `nativeImage().share`, в браузере телефона через `navigator.share` с файлом, на компьютере скачивается PNG; рекомендация — ссылкой на напиток; история участника — ссылкой `/?story=<id>`: главная передаёт её в `HomeStories openStory`, и просмотрщик открывается сразу на этой истории, пока она жива.
- Просмотрщик — `dialog` на весь экран: полоски прогресса, касание слева/справа, удержание — пауза, свайп вниз — закрыть, стрелки на компьютере; фото и карточки — 5 с, видео — до конца.

## Дейтинг напитков

- Вкладка «Дейтинг» в `/community?type=dating` (`DatingBrowser` → клиентский `SwipeDeck` в `swipe-deck.tsx`, стили `src/styles/dating.css`, иконка `dating` в `navigation-icon.tsx`). Колода карточек напитков: свайп/кнопка вправо и → — «нравится», влево и ← — «пропустить», «вернуть» откатывает последний свайп. Гость может листать, но свайпы не сохраняются — показывается призыв войти.
- Таблица `drinkSwipe` (миграция `0091_drink_swipes.sql`): одна строка на участника и напиток, повторный свайп меняет решение, «вернуть» удаляет строку; свайпать можно только напитки каталога (`recordSwipe` в `src/lib/drink-swipes.ts`, действия — `src/app/community/dating-actions.ts`), заблокированным нельзя.
- Колода (`getSwipeDeck`): напитки с фото, которые участник ещё не свайпал, не оценивал и не добавлял в избранное; сначала до 12 советов `rankRecommendations` (на карточке — объяснение `pickReason` из `src/lib/pick-reason.ts`, общее с историей «Тебе понравится», «Это мэтч!» при 2+ похожих фанатах), затем остальные в перемешивании, которое меняется раз в день. Под колодой — «Твои мэтчи» (`getLikedSwipes`).
- Свайпы влияют на рекомендации: в `opinions` «нравится» — 0,5, «пропустить» — −0,4, только если о напитке нет более сильного сигнала; лайкнутые свайпы участвуют в поиске похожих (`tasteNeighbourhood` в `story-digest.ts`, общая для истории и колоды). Страница напитка показывает «Свайпнули N · Пропустили M» (`getSwipeCounts`, блок `.catalog-swipe-stats` в `catalog.css`). Тесты: `test/drink-swipes.integration.test.ts`, `test/story-recommendations.test.ts`.
- Опыт и тег (миграция `0092_swipe_experience.sql`): +2 XP (`SWIPE_XP`) за каждый из первых 30 (`SWIPE_XP_LIMIT`) свайпов — триггер `swipe_experience` на вставку в `drinkSwipe`, `reason='swipe'`, `sourceKey` = `<бренд>:<вкус>`, поэтому смена решения и «вернуть» + повторный свайп не платят снова, а «вернуть» опыт не отбирает. Достижение «Свидание» — тег `date` «Люблю <3» (обычный, метрики `swipes` и `swipeLikes`: 20 свайпов и 5 мэтчей), арт — `public/brand/achievements/date.png`, +20 XP триггером `date_achievement_experience`. `recordSwipe` выдаёт тег сразу (`grantDateTag`) и возвращает `{ xp, tag }` — колода показывает «+2 XP» и уведомление о теге. Над колодой — островок наград (`DatingRewardsIsland` в `swipe-deck.tsx`): две плитки в ряд с полосками — XP за первые свайпы и путь к тегу; данные — `getDatingProgress` и `datingRewards()` (цели берутся из `PROFILE_ACHIEVEMENTS`), счётчики обновляются на странице после каждого свайпа и «вернуть», выполненная плитка пропадает. Меняя сумму или лимит, меняй `award_profile_experience` и константы вместе.
- Аналитика админки (`getAdminDashboardData`, вкладка «Аналитика»): график «Свайпы в дейтинге» за 14 дней по дню решения (в подсказке — лайки, пропуски и число участников) и сводка «Дейтинг» — всего, нравится/пропущено, свайпавшие участники всего и за 7 дней, напиток с наибольшим числом лайков. Считаются текущие решения без заблокированных: повторный свайп переносит строку на новый день, «вернуть» её удаляет. Тест: `test/admin-dashboard.integration.test.ts`.

## Главная

- Порядок (mobile-first, первого экрана и плиток разделов нет): истории `HomeStories` (раздел «Истории») → метрики `HomeMetrics` (`home-metrics.tsx`, данные — `getHomeCounts` и `catalogMetrics` в `src/lib/home-metrics.ts`: оценки, тирлисты, магазины с ценами, напитки; каждая плитка ведёт в свой раздел, нулевые не показываются; вид — карточки в синей гамме бренда (`#006EFF`, индиго `#4A4FE0`, `#0058CC`, тёмно-синий `#12203D`) с огромным белым числом и стикером из арта достижений в углу, `ART` в компоненте, 4 в ряд и на телефоне — там компактнее, стикер занимает нижнюю половину) → короткие баннеры событий `HomeEvents` («Топ месяца» — всегда первым, лидер и награда из `getMonthlyTop`, ведёт в `/leaderboard`; розыгрыш; «Двигатель»; на телефоне — короткие и листаются вбок, с 960 px — полноценные карточки с описанием `home-event-more` и кнопкой `home-event-cta`) → «Лента» (`FeedBrowser embedded`: бесконечная — первая страница с сервера, дальше `FeedMore` при прокрутке догружает страницы server action-ом `loadFeedPageAction` (`src/app/feed/actions.tsx`, строки рендерит общая `renderFeedItems`); автоматически до `AUTO_PAGES` (5) страниц, потом кнопка «Показать ещё», чтобы футер оставался достижим; поле записи для вошедших; главная импортирует `shared.css`, `profile.css`, `feed.css`). Баннера Telegram на главной нет: его заменила история «Telegram» (раздел «Истории»). Топ-100, объявлений, рейтинга и карты магазинов на главной больше нет. Боковые отступы — с 640 px как в каталоге (24 px); на телефоне у главной свой отступ 16 px и 32 px сверху (`.home-surface`), чтобы содержимое не прилипало к краю; полки выходят к краям экрана с тем же внутренним отступом 16 px. Ритм один: `--home-gap` 32/24 px между блоками, 12 px от заголовка до содержимого; встроенные блоки (`monthly-top`, `community-empty`) свои внешние отступы внутри секций не добавляют. Бенто и тирлистов на главной больше нет. Единственный `h1` страницы — скрытый (`sr-only`) заголовок в `page.tsx`. Ссылки на канал и бота — `TELEGRAM_CHANNEL_URL`/`TELEGRAM_BOT_URL` в `telegram-promo.tsx` (футер, настройки, конкурс, история «Telegram»).

## Футер

- `SiteFooter` (`site-footer.tsx`): бренд, строка описания и под ней плашка партнёра «При поддержке сообщества NRJ PARTY» (логотип `public/brand/partners/nrj-party.png` на белой плитке — он нарисован для белого фона; Telegram и TikTok партнёра в плитках `.footer-social-icon`, иконка — `tiktok-mark.svg` без своей подложки; на телефоне во всю ширину; стили `.footer-partner` в `globals.css`), затем связь и соцсети (канал и бот), ссылки сервиса и документов и нижняя строка с копирайтом и оговорками. Данные партнёра (описание, ссылки) — `NRJ_PARTY` в `src/lib/partners.ts`, их же берёт еженедельная история. В приложении футер скрыт (раздел «Android-приложение»).

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
