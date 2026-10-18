import Image from 'next/image';
import type { CSSProperties } from 'react';
import Link from '@/components/navigation-progress';
import { completion, earnedCollectionXp, flavors, nextMilestone, type BrandCollection, type CollectionItem, type CollectionSummary } from '@/lib/brand-collection-fields';

const SOURCE_LABELS = { review: 'отзыв', calendar: 'календарь' } as const;
const PREVIEW_BRANDS = 3;
const PREVIEW_CANS = 6;

function Progress({ collection, label }: { collection: { tried: number; total: number }; label: string }) {
  return <div className="brand-collection-progress" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={collection.total} aria-valuenow={collection.tried}
    aria-valuetext={`${collection.tried} из ${collection.total}`} style={{ '--collection-progress': completion(collection) } as CSSProperties} />;
}

function Can({ item, brand }: { item: CollectionItem; brand: string }) {
  const tried = item.tried.length > 0;
  return <Link className="brand-collection-can" data-tried={tried || undefined} href={item.href}
    title={tried ? `${brand} · ${item.name}: ${item.tried.map(source => SOURCE_LABELS[source]).join(', ')}` : `${brand} · ${item.name}: ещё не пробовали`}>
    <span className="brand-collection-cover">{item.cover ? <Image src={item.cover} width={96} height={96} sizes="96px" alt="" /> : <span aria-hidden="true">?</span>}</span>
    <span className="brand-collection-name">{item.name}</span>
    <span className="sr-only">{tried ? ', попробовано' : ', ещё не пробовали'}</span>
  </Link>;
}

const isComplete = (collection: { tried: number; total: number }) => collection.tried === collection.total;

function BrandHeading({ collection }: { collection: BrandCollection }) {
  const done = isComplete(collection);
  const next = nextMilestone(collection);
  return <span className="brand-collection-heading">
    <strong>{collection.brand}</strong>
    {done
      ? <span className="brand-collection-badge"><svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="m3.8 8.4 2.7 2.7 5.7-6.2" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>Собрано <b>{collection.tried} / {collection.total}</b></span>
      : <span className="brand-collection-count">{collection.tried} / {collection.total}</span>}
    <Progress collection={collection} label={`Коллекция ${collection.brand}`} />
    {next
      ? <span className="brand-collection-next">Ещё {flavors(next.needed - collection.tried)} до {next.percent}% · +{next.points} XP</span>
      : <span className="brand-collection-next">Все {flavors(collection.total)} в коллекции · получено +{earnedCollectionXp(collection)} XP</span>}
  </span>;
}

/** Full collection page: every brand is a disclosure, started ones are open. */
export function BrandCollectionList({ summary }: { summary: CollectionSummary }) {
  return <div className="brand-collection-list">{summary.brands.map(collection =>
    <details key={collection.brand} id={`brand-${collection.slug}`} className="community-panel brand-collection-card" data-done={isComplete(collection) || undefined} open={collection.tried > 0}>
      <summary><BrandHeading collection={collection} /></summary>
      <div className="brand-collection-grid">{collection.items.map(item => <Can key={`${item.brand}:${item.flavor}`} item={item} brand={collection.brand} />)}</div>
    </details>)}
  </div>;
}

export function BrandCollectionStats({ summary }: { summary: CollectionSummary }) {
  return <dl className="drink-streak-stats brand-collection-stats">
    <div data-stat="tried"><dt>Попробовано</dt><dd>{summary.tried} из {summary.total}</dd></div>
    <div><dt>Брендов начато</dt><dd>{summary.started} из {summary.brands.length}</dd></div>
    <div><dt>Собрано целиком</dt><dd>{summary.completed}</dd></div>
  </dl>;
}

/** Profile block: totals and the brands closest to completion. */
export function BrandCollectionBlock({ summary, username, isOwn }: { summary: CollectionSummary; username: string; isOwn: boolean }) {
  const href = `/profile/${username}/collection`;
  const started = summary.brands.filter(item => item.tried > 0).slice(0, PREVIEW_BRANDS);
  return <section className="community-panel brand-collection-block" aria-labelledby="brand-collection-title">
    <div className="community-section-heading"><h2 id="brand-collection-title">Коллекция вкусов</h2><Link href={href}>Все бренды ↗</Link></div>
    {summary.tried ? <>
      <BrandCollectionStats summary={summary} />
      <ul className="brand-collection-preview">{started.map(collection => <li key={collection.brand}>
        <Link href={`${href}#brand-${collection.slug}`} className="brand-collection-preview-row" data-done={isComplete(collection) || undefined}>
          <BrandHeading collection={collection} />
          <span className="brand-collection-strip" aria-hidden="true">{collection.items.slice(0, PREVIEW_CANS).map(item =>
            <span key={`${item.brand}:${item.flavor}`} className="brand-collection-cover" data-tried={item.tried.length > 0 || undefined}>{item.cover ? <Image src={item.cover} width={40} height={40} sizes="40px" alt="" /> : '?'}</span>)}</span>
        </Link>
      </li>)}</ul>
    </> : <div className="community-empty"><p>{isOwn ? `В каталоге ${flavors(summary.total)} от ${summary.brands.length} брендов. Оставьте отзыв или отметьте банку в календаре — вкус попадёт в коллекцию.` : 'Коллекция пока пуста.'}</p>
      {isOwn && <Link href={`/profile/${username}/calendar#add-drink`}>Отметить энергетик ↗</Link>}</div>}
  </section>;
}
