import Image from 'next/image';
import Link from '@/components/navigation-progress';
import { ShareTierListButton } from '@/components/share-tier-list-button';
import { TierBoard } from '@/components/tier-board';
import { TierListCard } from '@/components/tier-list-card';
import { TierScreenshotButton } from '@/components/tier-screenshot-button';
import { loadAllCatalogGroups } from '@/lib/catalog';
import { buildOfficialTierList, getCommunityTierLists, tierListProductsForPlacements } from '@/lib/tier-lists';

export type TierListSearchParams = { q?: string; metric?: string };

/**
 * The official board and community tier lists, with the search above the community lists.
 * /tierlists renders it as its page, /community under its own switcher with `basePath` and `keep`.
 */
export async function TierListsBrowser({ params, basePath = '/tierlists', keep = {} }: { params: TierListSearchParams; basePath?: string; keep?: Record<string, string> }) {
  const q = typeof params.q === 'string' ? params.q.trim().slice(0, 200) : '';
  const metric = params.metric === 'design' || params.metric === 'taste' ? params.metric : 'overall';
  const modes = { overall: 'Общий тирлист', design: 'По дизайну', taste: 'По вкусу' };
  const title = metric === 'overall' ? 'Тирлист энергетиков CanRush' : `Тирлист энергетиков CanRush — ${modes[metric].toLowerCase()}`;

  const groups = await loadAllCatalogGroups();
  const [official, community] = await Promise.all([buildOfficialTierList(groups, metric), getCommunityTierLists(48, q)]);
  const communityProducts = tierListProductsForPlacements(groups, community.flatMap((list) => list.preview));

  const form = (
    <form className="market-search-form" action={basePath} method="get">
      {Object.entries({ ...keep, metric }).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      <div className="market-search-toolbar"><div className="catalog-search-field">
        <button className="market-search-submit" type="submit" aria-label="Найти тирлисты"><Image src="/brand/icons/catalog-search.svg" width={24} height={24} alt="" /></button>
        <input key={q} type="search" name="q" defaultValue={q} maxLength={200} placeholder="Поиск по названию или автору" aria-label="Поиск тирлистов" />
      </div></div>
    </form>
  );
  return (<>
    <div className="tierlists-layout">
      <header className="tierlists-hero">
        <div>
          <p className="tierlists-kicker">Рейтинг CanRush</p>
          <h1>Тирлист энергетиков</h1>
          <p>
            В рейтинге участвуют напитки, доступные хотя бы в одном магазине и получившие минимум три отзыва.
          </p>
        </div>
        <dl className="tierlists-facts">
          <div><dt>Есть в продаже</dt><dd>{official.eligibleCount}</dd></div>
          <div><dt>Получили оценку</dt><dd>{official.ratedCount}</dd></div>
        </dl>
      </header>

      <nav className="catalog-volume-tabs tier-ranking-tabs" aria-label="Критерий рейтинга">
        {Object.entries(modes).map(([value, label]) => <Link key={value} href={`${basePath}?${new URLSearchParams({ ...keep, metric: value, ...(q ? { q } : {}) })}`} aria-current={metric === value ? 'page' : undefined}>{label}</Link>)}
      </nav>

      <TierBoard products={official.products} placements={official.placements} emptyLabel="Ждём оценок" />

      {official.ratedCount === 0 ? (
        <div className="tierlists-rating-note">
          <strong>Официальный рейтинг недоступен</strong>
          <p>Нужно больше позиций с тремя оценками и более</p>
          <Link href="/catalog">Перейти в каталог</Link>
        </div>
      ) : null}

      <div className="tierlists-main-actions">
        <Link className="tier-primary-action" href="/tierlists/new">
          Создать свой
          <Image src="/brand/icons/tierlists.svg" width={22} height={22} alt="" />
        </Link>
        <ShareTierListButton title={title} />
        <TierScreenshotButton boardId="tier-capture-board" title={title} official />
      </div>

      <section className="tierlists-community" aria-labelledby="community-title">
        <div className="tierlists-section-heading">
          <div>
            <p className="tierlists-kicker">Сообщество</p>
            <h2 id="community-title">Пользовательские тирлисты</h2>
          </div>
          {community.length > 0 ? <span>{community.length} последних</span> : null}
        </div>

        {form}
        {q && <Link href={`${basePath}?${new URLSearchParams({ ...keep, metric })}`}>Сбросить поиск</Link>}

        {community.length > 0 ? (
          <div className="tier-list-cards">
            {community.map((list) => <TierListCard list={list} products={communityProducts} key={list.id} />)}
          </div>
        ) : (
          <div className="tierlists-community-empty">
            <strong>{q ? 'Тирлисты не найдены' : 'Первый тирлист может быть вашим'}</strong>
            <p>{q ? 'Попробуйте другое название или имя автора.' : 'Разложите знакомые энергетики по категориям и поделитесь результатом.'}</p>
            <Link href="/tierlists/new">Создать первый тирлист</Link>
          </div>
        )}
      </section>
    </div>
  </>);
}
