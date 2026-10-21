import type { IngredientNutrition, NutritionField, PublishedIngredients } from '@canrush/shared';

const number = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });
/**
 * The two values people look up for an energy drink go first, as tiles: labels state them per 100 ml, and the tile
 * also counts the whole can so «30 мг» is never read as a can's dose. The rest is the usual nutrition row.
 */
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
  ai: 'Числа сгенерированы ИИ и могут отличаться от этикетки.',
};

/** Marks a composition written by AI without any source page. */
function AiChip() {
  return <span className="catalog-ai-chip" title="Состав сгенерирован ИИ без этикетки и не проверен">
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 14 9l6.5 2-6.5 2-2 6.5-2-6.5L3.5 11 10 9Z" fill="currentColor" /><path d="M19 2.5 19.7 4.3 21.5 5l-1.8.7L19 7.5l-.7-1.8L16.5 5l1.8-.7Z" fill="currentColor" /></svg>
    Сгенерировано ИИ
  </span>;
}

function Nutrition({ data, volumeMl }: { data: IngredientNutrition; volumeMl: number }) {
  const active = ACTIVE.filter(item => data[item.field] !== undefined);
  const table = TABLE.filter(item => data[item.field] !== undefined);
  return (
    <div className="catalog-nutrition">
      {active.length > 0 && <dl className="catalog-nutrition-active">
        {active.map(item => <div key={item.field}>
          <dt>{item.label} <span>на 100 мл</span></dt>
          <dd>{number.format(data[item.field]!)}<span> {item.unit}</span></dd>
          <dd className="catalog-nutrition-can">≈ {Math.round((data[item.field]! * volumeMl) / 100)} {item.unit} в банке {volumeMl} мл</dd>
        </div>)}
      </dl>}
      {table.length > 0 && <h3 className="catalog-nutrition-title">Пищевая ценность <span>на 100 {data.per === '100g' ? 'г' : 'мл'}</span></h3>}
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
      {data?.nutrition && <Nutrition data={data.nutrition} volumeMl={data.volumeMl} />}
      {data?.status !== 'ai_generated' && <p className="catalog-product-note">Сверяйте состав{data?.nutrition ? ' и пищевую ценность' : ''} с этикеткой вашей банки.</p>}
    </section>
  );
}
