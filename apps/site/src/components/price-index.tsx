import { CITIES } from '@canrush/shared';
import Link from '@/components/navigation-progress';
import { PriceIndexViews } from '@/components/price-index-chart';
import { PriceIndexLists } from '@/components/price-index-lists';
import { RetailerBadge } from '@/components/retailer-badge';
import { dayOf, monthName, monthTo, volumeLabel, type IndexFilter, type PriceIndexView } from '@/lib/price-index-fields';

const money = (value: number) => `${value.toLocaleString('ru-RU', { minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 })} ₽`;
const signed = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toLocaleString('ru-RU', { maximumFractionDigits: 1 })}%`;
const icon = (path: string) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>;
const PIN = icon('M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z');
const GLOBE = icon('M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm-9 9h18M12 3c2.5 2.7 3.5 5.7 3.5 9s-1 6.3-3.5 9c-2.5-2.7-3.5-5.7-3.5-9s1-6.3 3.5-9Z');
const DOWN = icon('M12 5v14m-6-6 6 6 6-6');
const CLEAR = icon('M18 6 6 18M6 6l12 12');
export const cityName = (id: string) => CITIES.find(city => city.id === id)?.name ?? id;
const normalized = (value: string) => value.toLocaleLowerCase('ru-RU').replaceAll('ё', 'е');
/** The page's address for a filter: `/prices?city=…&brand=…`. */
export const pricesHref = (filter: IndexFilter) => {
  const params = new URLSearchParams({ ...(filter.city ? { city: filter.city } : {}), ...(filter.brand ? { brand: filter.brand } : {}) });
  return `/prices${params.size ? `?${params}` : ''}`;
};
const periodOf = (view: PriceIndexView) => view.firstDay.slice(0, 7) === view.lastDay.slice(0, 7) && view.firstDay !== view.lastDay
  ? `${Number(view.firstDay.slice(8, 10))}–${dayOf(view.lastDay)}` : dayOf(view.lastDay);

/**
 * «Индекс энергетиков» наверху страницы цен: типичная банка выбранного (город, бренд) на полке и с акцией, сдвиг к прошлому
 * месяцу, скидки и город посетителя к стране; «90 дней» — та же банка на графике.
 */
export function PriceIndexSection({ view, filter, visitorCity }: { view: PriceIndexView; filter: IndexFilter; visitorCity: string }) {
  const { change } = view;
  const versus = view.previousMonth ? ` к ${monthTo(view.previousMonth)}` : '';
  const can = view.volumeMl ? volumeLabel(view.volumeMl) : '';
  const place = filter.city ? cityName(filter.city) : 'Вся Россия';
  const mine = !filter.city ? view.cities.find(item => item.city === visitorCity) : null;
  const query = new URLSearchParams({ ...(filter.city ? { city: filter.city } : {}), ...(filter.brand ? { brand: filter.brand } : {}) }).toString();
  const numbers = <>
    <div className="price-index-numbers">
      {view.can.shelf !== null && <div className="price-index-number is-main">
        <small>На полке</small><b>{money(view.can.shelf)}</b>
        <span>{change?.shelf != null ? `${signed(change.shelf)}${versus}` : 'обычная цена, без акции'}</span>
      </div>}
      {view.can.paid !== null && <div className="price-index-number">
        <small>С акцией</small><b>{money(view.can.paid)}</b>
        <span>{change?.paid != null ? `${signed(change.paid)}${versus}` : 'что платят по предложению'}</span>
      </div>}
      {view.promo.discount !== null && <div className="price-index-number">
        <small>Средняя скидка</small><b>{Math.round(view.promo.discount)}%</b>
        <span>{view.promo.deep ? `у ${view.promo.deep}% акций — от 30%` : 'по акциям сетей'}</span>
      </div>}
    </div>
    <div className="price-index-place">
      {mine && <p className="price-index-city"><b>{cityName(mine.city)}</b> {mine.vsAverage === 0 ? '— как в среднем по стране.' : `— на ${Math.abs(mine.vsAverage).toLocaleString('ru-RU', { maximumFractionDigits: 1 })}% ${mine.vsAverage < 0 ? 'дешевле' : 'дороже'}, чем в среднем по стране.`}</p>}
      <div className="price-index-actions">
        {mine && <Link className="price-index-chip" href={pricesHref({ ...filter, city: mine.city })}>{PIN}Только {cityName(mine.city)}</Link>}
        {filter.city && <Link className="price-index-chip" href={pricesHref({ brand: filter.brand })}>{GLOBE}Вся Россия</Link>}
        <a className="price-index-chip" href="#price-index-details">{DOWN}Города, сети и бренды</a>
      </div>
    </div>
  </>;
  return <section className="price-index" aria-labelledby="price-index-title">
    <header className="price-index-head">
      <span className="price-index-kicker">Индекс энергетиков · {monthName(view.month)}</span>
      <h2 id="price-index-title">Сколько стоит {filter.brand ? `${filter.brand} ${can}` : `банка ${can}`}</h2>
      <p>{place} · {periodOf(view)}, {view.positions.toLocaleString('ru-RU')} цен в сетях{versus ? ` — сравниваем${versus}` : ''}</p>
    </header>
    <PriceIndexViews key={query} now={numbers} query={query} label={`${filter.brand ? `${filter.brand} ` : ''}${can} · ${place}`} />
  </section>;
}

/** «Где дешевле» под карточкой: города, сети и бренды выбранного, суженные поиском, и как это считается. */
export function PriceIndexDetails({ view, filter, query, visitorCity }: { view: PriceIndexView; filter: IndexFilter; query: string; visitorCity: string }) {
  const versus = view.previousMonth ? ` к ${monthTo(view.previousMonth)}` : '';
  const typed = normalized(query.trim());
  const named = (name: string) => !typed || normalized(name).includes(typed);
  const cities = view.cities.filter(item => named(cityName(item.city)));
  const chains = view.chains.filter(item => named(item.retailer));
  const brands = view.brands.filter(item => named(item.brand));
  const badges = Object.fromEntries(chains.map(chain => [chain.retailer, <RetailerBadge key={chain.retailer} name={chain.retailer} decorative />]));
  const start = filter.city && chains.length ? 'chains' : cities.length ? 'cities' : chains.length ? 'chains' : 'brands';
  return <section className="price-index price-index-details" id="price-index-details" aria-labelledby="price-index-details-title">
    <header className="price-index-head">
      <h2 id="price-index-details-title">Где дешевле</h2>
      <p>{filter.brand ?? 'Все бренды'} · {filter.city ? cityName(filter.city) : 'вся Россия'}</p>
      {typed && <div className="price-index-query"><p>По запросу «{query.trim()}»</p><Link className="price-index-chip" href={pricesHref(filter)}>{CLEAR}Сбросить поиск</Link></div>}
    </header>
    {cities.length + chains.length + brands.length
      ? <PriceIndexLists key={`${pricesHref(filter)}|${typed}`} city={filter.city ?? visitorCity} mineLabel={filter.city ? 'выбран' : 'ваш город'} badges={badges} start={start}
          cities={cities.map(item => ({ key: item.city, name: cityName(item.city), value: item.vsAverage, extra: item.can, href: pricesHref({ ...filter, city: item.city }) }))}
          chains={chains.map(item => ({ key: item.retailer, name: item.retailer, value: item.vsAverage, extra: item.discount }))}
          brands={[...brands].sort((a, b) => b.positions - a.positions).map(item => ({ key: item.brand, name: item.brand, value: item.perLitre, extra: item.change, href: pricesHref({ ...filter, brand: item.brand }) }))} />
      : <p className="price-index-empty">{typed ? `Ничего не нашлось по «${query.trim()}». Попробуйте другой бренд, сеть или город.` : 'Для сравнения пока мало цен — выберите город или бренд пошире.'}</p>}
    <details className="price-index-method">
      <summary>
        <span className="price-index-method-icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg></span>
        <span className="price-index-method-title"><b>Как считаем</b><small>Цены, полка и акция, график, сравнение</small></span>
        <svg className="price-index-method-chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </summary>
      <dl className="price-index-method-list">
        <div><dt>Откуда цены</dt><dd>Цены сетей, которые CanRush собирает каждый день в {CITIES.length} городах. Это цены предложений, а не продаж.</dd></div>
        <div><dt>На полке и с акцией</dt><dd>На полке — обычная цена: у акции это зачёркнутая цена. С акцией — что платят по предложению. Типичная банка — середина цен банок самого частого объёма (обычно 0,45 л).</dd></div>
        {view.previousMonth && <div><dt>Изменение</dt><dd>Средний сдвиг цен одних и тех же позиций (город, сеть, напиток, объём){versus}.{view.days < 20 ? ` Месяц ещё идёт: сравниваем ${periodOf(view)}.` : ''}</dd></div>}
        <div><dt>График за 90 дней</dt><dd>Те же позиции день к дню: новые и пропавшие предложения линию не двигают. Уровень линии — цена месяца из карточки.</dd></div>
        <div><dt>Города и сети</dt><dd>Сравниваем по одинаковым напиткам и по цене на полке: у многих сетей в данных есть только акционные цены. Зачёркнутая цена бывает выше обычной, поэтому сети с частыми акциями могут выглядеть чуть дороже.</dd></div>
        <div><dt>Бренды</dt><dd>Цена литра на полке. Упаковки по 12 и 24 банки пересчитываем в цену банки.</dd></div>
      </dl>
    </details>
  </section>;
}
