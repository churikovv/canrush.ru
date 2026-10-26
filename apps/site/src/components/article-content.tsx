import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from '@/components/navigation-progress';
import { sanitizeInline, type ArticleBlock } from '@/lib/article-fields';
import type { ArticleDrink } from '@/lib/articles';

/** Photo ids of the document in reading order, the cover first: the gallery's order. */
export function articlePhotos(blocks: readonly ArticleBlock[], coverId: string | null): string[] {
  return [...(coverId ? [coverId] : []), ...blocks.flatMap(block => block.type === 'image' ? [block.imageId] : [])];
}

/** Inline text was sanitised on save; it is re-checked here, so a stored row can never inject markup. */
const Inline = ({ html }: { html: string }) => <span dangerouslySetInnerHTML={{ __html: sanitizeInline(html) }} />;

const HEADINGS = { heading1: 'h2', heading2: 'h3', heading3: 'h4' } as const;

/**
 * The article as readers see it. Consecutive list items are grouped into one list (numbered ones count on), headings
 * shift one level down because the page title is the h1.
 */
export function ArticleContent({ blocks, drinks }: { blocks: readonly ArticleBlock[]; drinks: Record<string, ArticleDrink> }) {
  const out: ReactNode[] = [];
  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index]!;
    if (block.type === 'bulleted' || block.type === 'numbered' || block.type === 'todo') {
      const run: ArticleBlock[] = [];
      while (blocks[index]?.type === block.type) run.push(blocks[index++]!);
      index--;
      const items = run.map(item => 'text' in item ? <li key={item.id} data-checked={item.type === 'todo' ? String(item.checked === true) : undefined}>
        {item.type === 'todo' && <span className="article-check" aria-label={item.checked ? 'Выполнено' : 'Не выполнено'} role="img" />}<Inline html={item.text} />
      </li> : null);
      out.push(block.type === 'numbered' ? <ol key={block.id}>{items}</ol> : <ul key={block.id} className={block.type === 'todo' ? 'article-checklist' : undefined}>{items}</ul>);
      continue;
    }
    switch (block.type) {
      case 'paragraph': out.push(block.text ? <p key={block.id}><Inline html={block.text} /></p> : null); break;
      case 'heading1': case 'heading2': case 'heading3': {
        const Tag = HEADINGS[block.type];
        out.push(<Tag key={block.id}><Inline html={block.text} /></Tag>);
        break;
      }
      case 'quote': out.push(<blockquote key={block.id}><Inline html={block.text} /></blockquote>); break;
      case 'callout': out.push(<aside key={block.id} className="article-callout"><span aria-hidden="true">💡</span><div><Inline html={block.text} /></div></aside>); break;
      case 'divider': out.push(<hr key={block.id} />); break;
      case 'image': {
        // Photos in a row become one gallery grid; a single photo stays full width. Each opens the viewer (ArticleGallery).
        const run: Extract<ArticleBlock, { type: 'image' }>[] = [];
        while (blocks[index]?.type === 'image') run.push(blocks[index++] as Extract<ArticleBlock, { type: 'image' }>);
        index--;
        const figures = run.map(photo => <figure key={photo.id} className="article-figure">
          <button type="button" className="article-photo" data-photo={photo.imageId} aria-label={photo.caption ? `Открыть фото: ${photo.caption}` : 'Открыть фото'}>
            {/* eslint-disable-next-line @next/next/no-img-element -- served from the database, sized by the browser */}
            <img src={`/api/article-images/${photo.imageId}`} alt={photo.caption} loading="lazy" decoding="async" />
          </button>
          {photo.caption && <figcaption>{photo.caption}</figcaption>}
        </figure>);
        out.push(run.length > 1 ? <div key={block.id} className="article-gallery" data-count={Math.min(run.length, 4)}>{figures}</div> : figures);
        break;
      }
      case 'drink': {
        const drink = drinks[block.id];
        out.push(drink ? <Link key={block.id} className="article-drink" href={drink.href}>
          {drink.cover ? <Image src={drink.cover} width={64} height={64} alt="" unoptimized={drink.cover.startsWith('/')} /> : <span className="article-drink-bolt" aria-hidden="true">⚡</span>}
          <span><small>Напиток из каталога</small><strong>{drink.label}</strong></span>
          <span className="article-drink-arrow" aria-hidden="true">→</span>
        </Link> : null);
        break;
      }
    }
  }
  return <div className="article-content">{out}</div>;
}
