import Image from 'next/image';
import Link from '@/components/navigation-progress';
import { ProfileExperience } from '@/components/profile-experience';
import { profileTagLabel } from '@/lib/profile-achievements';
import type { CatalogDrink } from '@/lib/catalog-drinks';

const addedOn = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Moscow' });
const drinksWord = (count: number) => count % 10 === 1 && count % 100 !== 11 ? 'напиток' : [2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100) ? 'напитка' : 'напитков';

/** The end of a member-added drink's page: who added it, with avatar, tag, XP and how many drinks they brought. */
export function CatalogDrinkAuthor({ author, createdAt }: { author: CatalogDrink['author']; createdAt: Date }) {
  const name = author.name.trim() && !author.name.includes('@') ? author.name : author.username ?? 'Участник';
  const tag = profileTagLabel(author.tag);
  const href = author.username ? `/profile/${author.username}` : null;
  const avatar = author.avatarId
    ? <Image src={`/api/profile-images/${author.avatarId}`} width={64} height={64} unoptimized alt="" />
    : <span aria-hidden="true">{name.slice(0, 1).toLocaleUpperCase('ru-RU')}</span>;
  return <section className="catalog-product-section catalog-drink-author" aria-labelledby="catalog-drink-author-title">
    <div className="catalog-drink-author-card">
      <h2 id="catalog-drink-author-title">Добавил в каталог</h2>
      {href ? <Link className="catalog-drink-author-avatar" href={href} tabIndex={-1} aria-hidden="true">{avatar}</Link> : <span className="catalog-drink-author-avatar">{avatar}</span>}
      <div className="catalog-drink-author-who">
        {href ? <Link className="catalog-drink-author-name" href={href}><strong>{name}</strong><span>@{author.username}</span></Link> : <strong>{name}</strong>}
        <div className="catalog-drink-author-badges">
          {tag && <span className="profile-tag" data-tag={author.tag}>{tag}</span>}
          {author.username && <ProfileExperience username={author.username} initial={{ xp: author.xp, rank: null }} />}
        </div>
      </div>
      <dl className="catalog-drink-author-stats">
        <div><dt>Добавлен</dt><dd>{addedOn.format(createdAt).replace(/\s?г\.$/u, '')}</dd></div>
        <div><dt>В каталоге от автора</dt><dd>{author.drinks} {drinksWord(author.drinks)}</dd></div>
      </dl>
      {href && <Link className="community-button community-button-secondary catalog-drink-author-open" href={href}>Профиль</Link>}
    </div>
  </section>;
}
