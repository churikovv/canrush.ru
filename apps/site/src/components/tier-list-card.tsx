import { TierListAuthor } from '@/components/tier-list-author';
import Image from 'next/image';
import Link from '@/components/navigation-progress';
import type { TierListProduct, TierListSummary } from '@/lib/tier-list-types';

interface TierListCardProps {
  list: TierListSummary;
  products: TierListProduct[];
  showStatus?: boolean;
}

function itemKey(brand: string, flavor: string): string {
  return `${brand}\u0000${flavor}`;
}

export function TierListCard({ list, products, showStatus = false }: TierListCardProps) {
  const productByKey = new Map(products.map((product) => [itemKey(product.brand, product.flavor), product]));
  const href = list.status === 'published' ? `/tierlists/${list.slug}` : `/tierlists/${list.slug}/edit`;

  return (
    <article className="tier-list-card">
      <Link className="tier-list-card-preview" href={href} aria-label={`Открыть тирлист «${list.title}»`}>
        {list.preview.length > 0 ? (
          list.preview.map((placement) => {
            const product = productByKey.get(itemKey(placement.brand, placement.flavor));
            return product?.imageUrl ? (
              <Image
                src={product.imageUrl}
                width={50}
                height={50}
                sizes="50px"
                alt=""
                key={itemKey(placement.brand, placement.flavor)}
              />
            ) : null;
          })
        ) : (
          <span>Добавьте энергетики</span>
        )}
      </Link>
      <div className="tier-list-card-copy">
        <div className="tier-list-card-heading">
          <h3>
            <Link href={href}>{list.title}</Link>
          </h3>
          {showStatus ? (
            <span className={`tier-list-status tier-list-status-${list.status}`}>
              {list.status === 'published' ? 'Опубликован' : 'Черновик'}
            </span>
          ) : null}
        </div>
        <TierListAuthor author={list.author} />
        <p>
          {list.itemCount} {list.itemCount === 1 ? 'товар' : list.itemCount > 1 && list.itemCount < 5 ? 'товара' : 'товаров'}
        </p>
        {list.status === 'published' && (list.reactionsEnabled || list.commentsEnabled) && <div className="tier-list-card-stats">
          {list.reactionsEnabled && <span aria-label={`Лайки: ${list.likes}`}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 10v11H3V10h4Zm0 0 5-8c3 0 3 3 2 7h5a2 2 0 0 1 2 2l-2 8a2 2 0 0 1-2 2H7" /></svg>{list.likes}</span>}
          {list.commentsEnabled && <Link href={`${href}#tier-discussion`} aria-label={`Комментарии: ${list.comments}`}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true"><path d="M20 16a3 3 0 0 1-3 3H9l-5 3V6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v10Z" /></svg>{list.comments}</Link>}
        </div>}

      </div>
    </article>
  );
}
