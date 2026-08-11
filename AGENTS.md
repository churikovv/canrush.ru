# AGENTS.md — canrush.ru

Monorepo: парсер цен на энергетические напитки (РФ) + будущий сайт.
npm workspaces, TypeScript (ESM, NodeNext), Playwright, vitest.

## Структура

```
packages/shared/   # общие типы (Product, SourceName, конфиги) — собирается в dist/
apps/parser/       # парсер цен (Playwright + HTTP + фиды)
apps/site/         # сайт (заготовка)
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

Антибот: `src/browser/challenge.ts` (детект), `src/browser/session.ts`
(переиспользование сессий в `.sessions/<source>/`). Разблокировка —
`npm run session:unlock -- --source=<name>` (см. `apps/parser/README.md`).

## Команды (из корня)

```bash
npm install
npx playwright install chromium

npm run build        # сборка всех workspaces (shared → parser)
npm run lint         # eslint . --ext .ts
npm test             # vitest run (тесты в apps/parser/test)
npm run parse        # однократный прогон парсера
npm run parse -- --source=ozon,wildberries
npm run schedule     # планировщик (CRON_SCHEDULE из .env, по умолч. 0 6 * * * Europe/Moscow)
```

Команды парсера также доступны через workspace:
`npm -w apps/parser run doctor`, `npm -w apps/parser run session:unlock -- --source=...`.

## Важно для агентов

- **Сборка зависит от порядка**: `@canrush/shared` собирается в `dist/` первым
  (через `npm run build --workspaces`); `apps/parser` импортирует типы из
  `@canrush/shared` через `references` в `tsconfig.json`. Перед `npm run parse`
  убедись, что `packages/shared/dist` существует (`npm run build`).
- **ESM + NodeNext**: импорты локальных файлов обязаны иметь расширение `.js`
  (например `from './storage.js'`). Импорты из `@canrush/shared` — без расширения.
- **`noUncheckedIndexedAccess: true`**: результат индексного доступа (`arr[i]`,
  `map.get(k)`) считается `T | undefined` — обрабатывай undefined явно.
- **Тесты**: vitest, файлы `apps/parser/test/*.test.ts`. `tsconfig.json` парсера
  включает только `src` — тесты компилируются vitest'ом на лету, не падают в
  `dist`. Не добавляй `test/` в `include` tsconfig (это ломает `rootDir`/`outDir`).
- **Регулярки с кириллицей**: не используй `\b` рядом с кириллическими буквами
  без флага `u` — JS считает word-границу только по ASCII. См. `extractVolumeMl`
  в `apps/parser/src/normalize.ts` (используется `(?![a-zа-яё])`).
- **Не коммить**: `.sessions/`, `data/raw/`, `data/history/`, `data/latest.json`,
  `data/state.json`, `.env` (см. `.gitignore`).
- **Робототехника**: `src/robots.ts` уважает `robots.txt`. Не отключай его.
- **Антибот/блокировки — это норма**: источники часто возвращают 403/498/капчу.
  Не пытайся «обойти» защиту агрессивнее — используй `session:unlock` и
  stale-фоллбэк (`mergeResults` в `storage.ts`). Не увеличивай частоту запросов
  сверх разумного (базовая задержка 3с + джиттер в `run.ts`).
- **Безопасность**: не логируй и не коммить токены (`TG_BOT_TOKEN`, `OZON_FEED_URL`
  с ключами). Секреты — только в `.env`, который в `.gitignore`.

## Верификация перед завершением задачи

```bash
npm run build
npm run lint
npm test
```

Все три должны проходить без ошибок (warnings eslint допустимы).
