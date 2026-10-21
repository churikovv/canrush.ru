import type { IngredientNutrition, NutritionField, PublishedIngredients } from '@canrush/shared';

const number = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });
/** The two values people look up for an energy drink go first, as tiles; the rest is the usual nutrition row. */
const ACTIVE: { field: NutritionField; label: string; unit: string }[] = [
  { field: 'caffeineMg', label: 'Кофеин', unit: 'мг' },
  { field: 'taurineMg', label: 'Таурин', unit: 'мг' },
];
const TABLE: { field: NutritionField; label: string; unit: string }[] = [
  { field: 'energyKcal', label: 'Калории', unit: 'ккал' },
  { field: 'protein', label: 'Белки', unit: 'г' },
  { field: 'fat', label: 'Жиры', unit: 'г' },
  { field: 'carbs', label: 'Углеводы', unit: 'г' },
  { field: 'sugar', label: 'Сахар', unit: 'г' },
];

const NUTRITION_NOTES: Record<IngredientNutrition['method'], string> = {
  store: 'Данные из карточки товара в магазине.',
  gigachat: 'Числа распознаны автоматически из описания в магазине.',
  ai: 'Числа написал ИИ по общим знаниям о напитке и могут сильно отличаться от этикетки.',
};

/** Marks a composition the model wrote without any source page. */
function AiChip() {
  return <span className="catalog-ai-chip" title="Состав и числа сгенерированы GigaChat без этикетки и не проверены">
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 14 9l6.5 2-6.5 2-2 6.5-2-6.5L3.5 11 10 9Z" fill="currentColor" /><path d="M19 2.5 19.7 4.3 21.5 5l-1.8.7L19 7.5l-.7-1.8L16.5 5l1.8-.7Z" fill="currentColor" /></svg>
    Сгенерировано ИИ
  </span>;
}

function Nutrition({ data }: { data: IngredientNutrition }) {
  const active = ACTIVE.filter(item => data[item.field] !== undefined);
  const table = TABLE.filter(item => data[item.field] !== undefined);
  return (
    <div className="catalog-nutrition">
      <h3 className="catalog-nutrition-title">Пищевая ценность <span>на 100 {data.per === '100g' ? 'г' : 'мл'}</span></h3>
      {active.length > 0 && <dl className="catalog-nutrition-active">
        {active.map(item => <div key={item.field}><dt>{item.label}</dt><dd>{number.format(data[item.field]!)}<span> {item.unit}</span></dd></div>)}
      </dl>}
      {table.length > 0 && <dl className="catalog-nutrition-table">
        {table.map(item => <div key={item.field}><dt>{item.label}</dt><dd>{number.format(data[item.field]!)}<span> {item.unit}</span></dd></div>)}
      </dl>}
      <p className="catalog-nutrition-note">{NUTRITION_NOTES[data.method]}</p>
    </div>
  );
}

export function CatalogProductIngredients({ data }: { data: PublishedIngredients | null }) {
  return (
    <section className="catalog-product-section catalog-ingredients-card" aria-labelledby="composition-title">
      <div className="catalog-ingredients-heading">
        <h2 id="composition-title">Состав</h2>
        {data?.status === 'ai_generated' && <AiChip />}
      </div>
      <p className="catalog-ingredients-text">
        {data?.ingredients ?? 'Состав для этого напитка пока не добавлен.'}
      </p>
      {data?.nutrition && <Nutrition data={data.nutrition} />}
      <p className="catalog-product-note">{data?.status === 'ai_generated'
        ? 'Состав написал ИИ GigaChat по общим знаниям, без этикетки и без проверки. Ориентируйтесь на этикетку вашей банки.'
        : `Сверяйте состав${data?.nutrition ? ' и пищевую ценность' : ''} с этикеткой вашей банки.`}</p>
    </section>
  );
}
