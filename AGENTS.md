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
- **Magic Link invariants**: токен живёт 5 минут, хранится как хэш и погашается
  один раз. Email-ссылка ведёт на GET interstitial, а вход выполняется только
  явным POST через Server Action. Action вызывает встроенный `magicLinkVerify`
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
- **Тесты**: vitest, файлы `apps/parser/test/*.test.ts`. `tsconfig.json` парсера
  включает только `src` — тесты компилируются vitest'ом на лету, не падают в
  `dist`. Не добавляй `test/` в `include` tsconfig (это ломает `rootDir`/`outDir`).
- **Регулярки с кириллицей**: не используй `\b` рядом с кириллическими буквами
  без флага `u` — JS считает word-границу только по ASCII. См. `extractVolumeMl`
  в `apps/parser/src/normalize.ts` (используется `(?![a-zа-яё])`).
- **Не коммить**: `.sessions/`, `data/raw/`, `data/history/`, `data/latest.json`,
  `data/state.json`, `apps/site/data/`, `apps/site/public/images/`, `.env` (см. `.gitignore`).
- **Робототехника**: `src/robots.ts` уважает `robots.txt`. Не отключай его.
- **Едадил — агрегатор**: `source: 'edadeal'`, а сеть (Пятёрочка/Магнит/…) — в
  `Product.retailer`; цены только акционные (`promoEndsAt`). Это единственный
  источник без Playwright — не добавляй ему браузерных стратегий и не ходи на
  запрещённые в `robots.txt` страницы `edadeal.ru` (поиск, `/offers/*`). Полная
  выдача собирается через брендовые батчи (обычный ответ обрезан до 600 групп),
  бренд — по `brandUuid`, затем через глобальные `brandAliases`. Не убирай паузу
  800 мс между запросами.
- **Антибот/блокировки — это норма**: источники часто возвращают 403/498/капчу.
  Не пытайся «обойти» защиту агрессивнее — используй `session:unlock` и
  stale-фоллбэк (`mergeResults` в `storage.ts`). Не увеличивай частоту запросов
  сверх разумного (базовая задержка 3с + джиттер в `run.ts`).
- **Безопасность**: не логируй и не коммить токены (`TG_BOT_TOKEN`, `OZON_FEED_URL`
  с ключами). Секреты — только в `.env`/`.env.local`, которые в `.gitignore`.

## Верификация перед завершением задачи

```bash
npm run build
npm run lint
npm test
npm -w apps/site run typecheck
npm -w apps/site run test:auth
```

Все три должны проходить без ошибок (warnings eslint допустимы).
