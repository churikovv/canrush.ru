import type { PublishedIngredients } from '@canrush/shared';

export function CatalogProductIngredients({ data }: { data: PublishedIngredients | null }) {
  return (
    <section className="catalog-product-section catalog-ingredients-card" aria-labelledby="composition-title">
      <h2 id="composition-title">Состав</h2>
      <p className="catalog-ingredients-text">
        {data?.ingredients ?? 'Состав для этого напитка пока не добавлен.'}
      </p>
      <p className="catalog-product-note">Сверяйте состав с этикеткой вашей банки.</p>
    </section>
  );
}
