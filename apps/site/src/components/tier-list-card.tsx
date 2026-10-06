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

function authorName(list: TierListSummary): string {
  const name = list.author.name.trim();
  return name && !name.includes('@') ? name : list.author.username;
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
        <p>
          <Link href={`/profile/${list.author.username}`}>@{list.author.username}</Link>
          <span aria-hidden="true"> · </span>
          {list.itemCount} {list.itemCount === 1 ? 'товар' : list.itemCount > 1 && list.itemCount < 5 ? 'товара' : 'товаров'}
        </p>
        <span className="sr-only">Автор: {authorName(list)}</span>
      </div>
    </article>
  );
}
