import type { PublishedIngredients } from '@canrush/shared';

export function CatalogProductIngredients({ data }: { data: PublishedIngredients | null }) {
  return (
    <section className="catalog-product-section" aria-labelledby="composition-title">
      <h2 id="composition-title">Состав и пищевая ценность</h2>
      {data ? (
        <>
          <div className="catalog-ingredients-disclaimer" role="note">
            <p className="catalog-ingredients-status">Состав не подтверждён</p>
            <p>
              {data.status === 'unverified'
                ? data.reviewNote
                : 'Данные из открытого источника, пока не сверены с этикеткой.'}
            </p>
          </div>
          <p className="catalog-ingredients-version">
            {data.productTitle} · {data.market === 'BY' ? 'Версия для рынка Беларуси' : 'Российский рынок'}
          </p>
          <p className="catalog-ingredients-text">{data.ingredients}</p>
          <p className="catalog-ingredients-source">
            По данным{' '}
            <a href={data.sourceUrl} target="_blank" rel="noopener noreferrer">{data.sourceName}</a>
            {' · '}Получено{' '}
            <time dateTime={data.fetchedAt}>
              {new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Moscow' }).format(new Date(data.fetchedAt))}
            </time>
          </p>
          <p className="catalog-product-note">
            {data.market === 'BY' ? 'Рецептура российской версии может отличаться. ' : ''}
            Сверяйте состав с этикеткой вашей банки.
          </p>
          <p className="catalog-product-note">Пищевая ценность пока не добавлена.</p>
        </>
      ) : (
        <p className="catalog-product-note-card">Состав для этого напитка пока не добавлен.</p>
      )}
    </section>
  );
}
