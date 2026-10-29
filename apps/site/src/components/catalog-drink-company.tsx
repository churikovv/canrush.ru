import Image from 'next/image';
import Link from '@/components/navigation-progress';
import { CompanyFollowButton } from '@/components/company-follow-button';
import { BUSINESS_KINDS } from '@/lib/business-fields';
import type { CompanyCard } from '@/lib/business-profile';

// With a day the month comes in the genitive («октября»); the day itself is dropped.
const since = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Moscow' });
const plural = (count: number, one: string, few: string, many: string) =>
  count % 10 === 1 && count % 100 !== 11 ? one : [2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100) ? few : many;

/**
 * The end of a brand's drink page, in the place of a member's author card: the company that published or confirmed
 * the drink. The logo and the name lead to its profile, «Подписаться» sits beside them.
 */
export function CatalogDrinkCompany({ company, signedIn }: { company: CompanyCard; signedIn: boolean }) {
  const href = `/company/${company.id}`;
  const kind = BUSINESS_KINDS.find(item => item.value === company.kind)?.label ?? 'Компания';
  const logo = company.logoId
    ? <Image src={`/api/business-logos/${company.logoId}`} width={64} height={64} unoptimized alt="" />
    : <span aria-hidden="true">{company.name.slice(0, 1).toLocaleUpperCase('ru-RU')}</span>;
  return <section className="catalog-product-section catalog-drink-author catalog-drink-company" aria-labelledby="catalog-drink-company-title">
    <div className="catalog-drink-author-card">
      <h2 id="catalog-drink-company-title">От бренда</h2>
      <Link className="catalog-drink-author-avatar" href={href} tabIndex={-1} aria-hidden="true">{logo}</Link>
      <div className="catalog-drink-author-who">
        <Link className="catalog-drink-author-name" href={href}>
          <strong>{company.name}<span className="catalog-company-check" title="Проверено CanRush" aria-label="Проверено CanRush"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 12.5 4 4 8-9" /></svg></span></strong>
          <span>Официальный профиль · {kind}</span>
        </Link>
        {company.bio && <p className="catalog-drink-company-bio">{company.bio}</p>}
      </div>
      <CompanyFollowButton businessId={company.id} following={company.following} followers={company.followers} signedIn={signedIn} />
      <dl className="catalog-drink-author-stats">
        <div><dt>В каталоге</dt><dd>{company.drinks} {plural(company.drinks, 'напиток', 'напитка', 'напитков')}</dd></div>
        <div><dt>На CanRush</dt><dd>с {since.format(company.createdAt).replace(/^\d+\s/u, '').replace(/\s?г\.$/u, '')}</dd></div>
      </dl>
    </div>
  </section>;
}
