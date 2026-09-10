/**
 * Единая схема данных, которой должны соответствовать все адаптеры источников.
 * Используется парсером для нормализации и будущим сайтом для отображения цен.
 */

export const SOURCES = [
  'wildberries',
  'ozon',
  'pyaterochka',
  'magnit',
  'lenta',
  'edadeal',
] as const;

export type SourceName = (typeof SOURCES)[number];

/**
 * Статус получения данных по источнику за последний прогон:
 * - ok      — данные получены живьём в этом прогоне
 * - stale   — источник недоступен (блок/капча), отдаём последние известные цены
 * - blocked — источник недоступен и старых данных нет вовсе
 * - error   — неожиданная ошибка адаптера (не связанная с антиботом)
 */
export const SOURCE_STATUSES = ['ok', 'stale', 'blocked', 'error'] as const;
export type SourceStatus = (typeof SOURCE_STATUSES)[number];

/** Стратегии получения данных, см. apps/parser/src/fetch/strategy.ts */
export const FETCH_STRATEGIES = ['feed', 'http_api', 'intercept', 'in_page_fetch', 'cached'] as const;
export type FetchStrategyName = (typeof FETCH_STRATEGIES)[number];

export type BrandAliases = Record<string, string[]>;
export type FlavorAliases = Record<string, string[]>;

export const ENERGY_DRINK_BRAND_ALIASES: BrandAliases = {
  'Red Bull': ['Ред Булл', 'Редбулл', 'Ред Бул', 'Редбул'],
  'Adrenaline Rush': ['Adrenalin Rush', 'Адреналин Раш'],
  'Flash Up': ['FlashUp', 'Флэш Ап', 'Флеш Ап', 'Флэшап', 'Флешап'],
  Burn: ['Берн', 'Бёрн', 'Бурн'],
  Monster: ['Monster Energy', 'Монстр', 'Монстер', 'Монстр Энерджи', 'Монстер Энерджи'],
  Tornado: ['Tornado Energy', 'Торнадо'],
  Gorilla: ['Горилла'],
  'Drive Me': ['Драйв Ми', 'Драйвми'],
  Bang: ['Бэнг', 'Банг'],
  Predator: ['Предатор'],
  Adrenaline: ['Адреналин'],
  'Volt Energy': ['Вольт Энерджи', 'Вольт'],
  'Lit Energy': ['Лит Энерджи', 'Лит'],
  Jaguar: ['Ягуар'],
  'My Element': ['Element', 'Май Элемент', 'Элемент'],
  Vulkan: ['Вулкан'],
  'M-150': ['М-150', 'М150'],
  'Doma By Guf': ['Дома Бай Гуф', 'Гуф'],
  'Ninja Star': ['Ниндзя Стар'],
  BOMBBAR: ['Бомббар', 'Бомб Бар', 'Бомбар'],
};

export interface Product {
  /** Источник данных */
  source: SourceName;
  /** Идентификатор товара у источника (артикул/id) */
  sourceId: string;
  /** Название товара, как на сайте источника */
  name: string;
  /** Бренд, если удалось определить */
  brand?: string;
  /** Вкус (канонический), если удалось определить: 'original' | 'kiwi' | 'apple' … */
  flavor?: string;
  /** Объём в миллилитрах, если удалось определить */
  volumeMl?: number;
  /** Текущая цена в рублях */
  price: number;
  /** Цена до скидки, если есть */
  oldPrice?: number;
  /** Валюта (пока только рубли) */
  currency: 'RUB';
  /** Ссылка на карточку товара */
  url: string;
  /** Ссылка на изображение товара */
  imageUrl?: string;
  /** Категория/раздел, из которого получен товар */
  category?: string;
  /** Торговая сеть, в которой действует цена — для агрегаторов (Едадил: «Пятёрочка», «Магнит»…) */
  retailer?: string;
  /** Дата окончания акции (ISO 8601), если цена акционная и срок известен */
  promoEndsAt?: string;
  /** Момент получения данных (ISO 8601) */
  fetchedAt: string;
  /** true, если запись перенесена из предыдущего успешного прогона (источник сейчас недоступен) */
  stale?: boolean;
  /** Когда товар был получен живьём в последний раз (актуально для stale-записей) */
  lastSeenAt?: string;
}

/** Конфигурация запроса к конкретному источнику (см. apps/parser/config/products.json) */
export interface SourceQueryConfig {
  /** Поисковый запрос (для маркетплейсов) */
  query?: string;
  /** Ключевые слова категории для фильтрации фидов/выдачи (наследуются из ProductsConfig.keywords) */
  keywords?: string[];
  /** Слаг/идентификатор категории на сайте источника */
  categorySlug?: string;
  /** Числовой id категории во внутреннем API источника (Магнит/Пятёрочка) */
  categoryId?: string;
  /** Код магазина (Магнит: storeCode) */
  storeCode?: string;
  /** Код магазина доставки (Пятёрочка: sapCode) */
  sapCode?: string;
  /** Регион/город для ритейлеров, влияющий на цены и наличие */
  regionId?: string;
  /** Явный список брендов/названий для фильтрации результатов */
  brands?: string[];
  brandAliases?: BrandAliases;
  /** Список канонических вкусов для извлечения из названия товара */
  flavors?: string[];
  flavorAliases?: FlavorAliases;
  /** Ограничение на количество страниц/товаров за один запуск */
  maxItems?: number;
  /** URL партнёрского товарного фида (YML/CSV), если используется стратегия feed */
  feedUrl?: string;
  /** Порядок стратегий получения данных для этого источника, по умолчанию берётся из адаптера */
  strategies?: FetchStrategyName[];
}

export interface ProductsConfig {
  category: string;
  keywords: string[];
  brands: string[];
  brandAliases?: BrandAliases;
  flavors: string[];
  flavorAliases?: FlavorAliases;
  sources: Partial<Record<SourceName, SourceQueryConfig>>;
}

export interface AdapterFetchResult {
  products: Product[];
  /** Какая стратегия из strategies реально сработала в этом вызове */
  strategyUsed: FetchStrategyName;
}

/** Общий интерфейс адаптера источника данных */
export interface SourceAdapter {
  source: SourceName;
  /** Стратегии в порядке приоритета, которые поддерживает адаптер */
  strategies: FetchStrategyName[];
  fetchPrices(config: SourceQueryConfig): Promise<AdapterFetchResult>;
}

/** Результат работы одного адаптера, включая информацию об ошибках */
export interface AdapterRunResult {
  source: SourceName;
  status: SourceStatus;
  /** Стратегия, которой удалось получить данные (или на которой остановились) */
  strategyUsed?: FetchStrategyName;
  products: Product[];
  error?: string;
  startedAt: string;
  finishedAt: string;
}

/** Персистентое состояние по источнику между запусками (data/state.json) */
export interface SourceState {
  source: SourceName;
  status: SourceStatus;
  strategyUsed?: FetchStrategyName;
  lastAttemptAt?: string;
  lastSuccessAt?: string;
  lastError?: string;
}

export interface ParserState {
  updatedAt: string;
  sources: Partial<Record<SourceName, SourceState>>;
}

/** Один вариант цены внутри карточки каталога (один источник — один вариант) */
export interface FlavorVariant {
  source: SourceName;
  /** Торговая сеть (для агрегаторов вроде Едадил): «Пятёрочка», «Магнит»… */
  retailer?: string;
  volumeMl?: number;
  price: number;
  oldPrice?: number;
  url: string;
  imageUrl?: string;
  promoEndsAt?: string;
  stale?: boolean;
  fetchedAt: string;
}

/**
 * Карточка каталога: один бренд + один вкус.
 * Внутри — список вариантов (по источникам/объёмам) с ценами.
 * Группировка выполняется парсером на финальном слитии (см. storage.groupByFlavor).
 */
export interface CatalogGroup {
  brand: string;
  /** Канонический вкус; 'original' если вкус не удалось определить */
  flavor: string;
  variants: FlavorVariant[];
  /** Минимальная цена среди variants — для сортировки/отображения */
  minPrice: number;
  /** Обложка карточки (imageUrl первого варианта, где есть изображение) */
  coverImageUrl?: string;
}
