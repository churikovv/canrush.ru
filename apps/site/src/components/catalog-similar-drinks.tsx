import { CatalogProductCard } from '@/components/catalog-product-card';
import { CatalogSimilarRow } from '@/components/catalog-similar-row';
import { similarReasonText } from '@/lib/similar-drink-fields';
import { getSimilarDrinks } from '@/lib/similar-drinks';

/**
 * «Похожее» at the end of a drink page: catalog cards in one row that scrolls sideways (`CatalogSimilarRow`,
 * arrows for a mouse), each with why it is
 * suggested. Streams in after the page (the page wraps it in Suspense); nothing at all when there is too little to show
 * or the data is away.
 */
export async function CatalogSimilarDrinks({ brand, flavor, viewerId }: { brand: string; flavor: string; viewerId: string | null }) {
  const items = await getSimilarDrinks({ brand, flavor }, viewerId).catch(() => []);
  if (!items.length) return null;
  return <section className="catalog-similar" aria-labelledby="catalog-similar-title">
    <CatalogSimilarRow head={<div>
      <h2 id="catalog-similar-title">Похожее</h2>
      <p>По вкусу и оценкам участников</p>
    </div>}>
      {items.map(({ group, summary, reason }) => <li key={`${group.brand}:${group.flavor}`}>
        <CatalogProductCard group={group} summary={summary} eager={false} heading="h3" note={reason ? similarReasonText(reason) : undefined} />
      </li>)}
    </CatalogSimilarRow>
  </section>;
}
