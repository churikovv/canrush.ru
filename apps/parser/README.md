# @canrush/parser

Парсер цен на энергетические напитки с российских ритейлеров и маркетплейсов:
**Wildberries, Ozon, Пятёрочка, Магнит, Лента**.

Сохраняет консолидированный срез в `data/latest.json`, сырые снапшоты каждого
источника — в `data/raw/<source>/<timestamp>.json`, историю за день — в
`data/history/<YYYY-MM-DD>.json`. При временной блокировке источника подмешивает
его товары из предыдущего успешного прогона с флагом `stale: true`, чтобы сайт
не оставался без данных.

## Установка

Из корня репозитория (npm workspaces):

```bash
npm install
npx playwright install chromium   # браузер для Playwright-адаптеров
```

Опционально — использовать установленный Google Chrome вместо бандлового
Chromium (снижает детект автоматизации):

```bash
cp .env.example .env
# раскомментируйте PARSER_BROWSER_CHANNEL=chrome
```

## Команды

Все команды запускаются из `apps/parser/` (или через `npm -w apps/parser ...`).

| Команда                          | Описание                                                        |
| -------------------------------- | --------------------------------------------------------------- |
| `npm run parse`                  | Однократный прогон всех источников из `config/products.json`.   |
| `npm run parse -- --source=ozon` | Прогон только выбранных источников (через запятую).             |
| `npm run schedule`               | Долгоживущий планировщик (`node-cron`, `CRON_SCHEDULE` из .env).|
| `npm run doctor`                 | Диагностика: открывает каждый источник и печатает статус.       |
| `npm run doctor -- --headed`     | То же в видимом браузере.                                       |
| `npm run session:unlock -- --source=<name>` | Ручная разблокировка сессии источника (см. ниже).     |
| `npm test`                       | Unit-тесты (vitest): normalize, storage, parseFeed, challenge.  |
| `npm run build`                  | Сборка TS в `dist/`.                                            |

## Конфигурация `config/products.json`

Общие поля:

- `category` — идентификатор категории (`energy_drinks`).
- `keywords` — список ключевых слов для фидов и запасного поиска.
- `brands` — список брендов для автоопределения (`detectBrand`).

Конфиг каждого источника живёт в `sources.<name>`:

```jsonc
{
  "wildberries": { "query": "энергетический напиток", "maxItems": 200 },
  "ozon":        { "query": "энергетический напиток", "maxItems": 100 },
  "pyaterochka": { "query": "энергетик", "maxItems": 48 },
  "magnit":      { "categoryId": "", "storeCode": "", "maxItems": 36 },
  "lenta":       { "query": "энергетик", "maxItems": 48 }
}
```

### Где взять `categoryId` / `storeCode` для Магнита

Адаптер Магнита (`src/adapters/magnit.ts`) ходит в каталог конкретного магазина.
Нужно указать:

1. **`storeCode`** — код магазина доставки. Откройте `https://magnit.ru`,
   выберите город и магазин, затем в URL страницы магазина найдите код
   (например `https://magnit.ru/catalog/?store=NNNN` → `storeCode = "NNNN"`).
2. **`categoryId`** — идентификатор категории «Энергетические напитки».
   Откройте нужную подкатегорию в каталоге и возьмите `id` из URL/ответа
   каталога, либо подсмотрите его в Network-вкладке при открытии категории.

Запишите значения в `config/products.json` → `sources.magnit`.

### Партнёрский фид Ozon (опционально, рекомендуется)

Ozon жёстко блокирует автоматизацию. Вместо браузерного парсинга можно
использовать партнёрский товарный XML/CSV-фид (Admitad, CityAds и т.п.) —
адаптер `src/adapters/ozon.ts` сначала пробует фид, и только при его отсутствии
падает на браузерный intercept.

Чтобы включить фид, задайте URL в `.env`:

```bash
OZON_FEED_URL=https://...admitad.com/.../ozon_products.xml
```

Логика парсинга фида — в `src/feed/ozonFeed.ts` и `src/feed/parseFeed.ts`.

## `session:unlock` — разблокировка сессии

Ритейлеры (Пятёрочка, Лента, WB) защищены антибот-системами и требуют выбора
магазина доставки. Playwright-сессии сохраняются в `apps/parser/.sessions/<source>/`
и переиспользуются между прогонами.

При первом запуске или после истечения сессии источник вернёт статус
`BLOCKED`/`CHALLENGE`. Чтобы разблокировать:

```bash
npm run session:unlock -- --source=pyaterochka
```

Откроется видимый браузер:

1. Пройдите капчу/проверку, если она появилась.
2. Выберите магазин доставки, если каталог этого требует.
3. Убедитесь, что каталог открывается нормально.
4. Вернитесь в терминал и нажмите **Enter**.

Сессия (cookies + storage state) сохранится, и последующие прогоны `npm run parse`
будут использовать её в headless-режиме. Повторяйте процедуру при повторных
блокировках.

## Структура данных

```
data/
├── latest.json              # консолидированный срез для сайта
├── state.json               # состояние источников (lastSuccessAt и т.д.)
├── raw/<source>/<ts>.json   # сырой результат каждого адаптера
└── history/<YYYY-MM-DD>.json# история цен за день
```

`latest.json` имеет формат:

```jsonc
{
  "generatedAt": "2026-08-11T06:00:00.000Z",
  "count": 42,
  "products": [
    {
      "source": "wildberries",
      "sourceId": "123",
      "name": "Red Bull Энергетический напиток 0.355л",
      "brand": "Red Bull",
      "volumeMl": 355,
      "price": 129,
      "oldPrice": 149,
      "currency": "RUB",
      "url": "https://...",
      "imageUrl": "https://...",
      "category": "energy_drinks",
      "fetchedAt": "2026-08-11T06:00:01.000Z",
      "stale": false
    }
  ]
}
```

Товары из заблокированных источников помечаются `stale: true` и переносятся из
предыдущего успешного прогона (см. `mergeResults` в `src/storage.ts`).

## Архитектура адаптеров

Каждый адаптер реализует интерфейс `SourceAdapter` (`src/adapters/types.ts`):

```ts
interface SourceAdapter {
  fetchPrices(config: SourceQueryConfig): Promise<{
    products: Product[];
    strategyUsed: 'feed' | 'intercept' | 'in_page_fetch';
  }>;
}
```

Стратегии:

- **`feed`** — партнёрский XML/CSV-фид (Ozon через `OZON_FEED_URL`).
- **`intercept`** — Playwright перехватывает JSON-ответы API сайта (Wildberries).
- **`in_page_fetch`** — Playwright выполняет `fetch` внутри страницы с cookies
  пользователя (Пятёрочка, Магнит, Лента).

Робототехника уважается через `src/robots.ts`. Антибот-детект и ожидание
челленджа — в `src/browser/challenge.ts`. Сессии — в `src/browser/session.ts`.
