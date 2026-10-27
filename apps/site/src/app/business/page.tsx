import '@/styles/shared.css';
import '@/styles/business.css';
import type { Metadata } from 'next';
import type { CSSProperties, ReactNode } from 'react';
import Image from 'next/image';
import { headers } from 'next/headers';
import { CITIES } from '@canrush/shared';
import { BrandShell } from '@/components/brand-shell';
import Link from '@/components/navigation-progress';
import { ProfileNavigation } from '@/components/profile-navigation';
import { getPool } from '@/db/pool';
import { auth } from '@/lib/auth';
import { loadAllCatalogGroups } from '@/lib/catalog';
import { isCountedCatalogDrink } from '@/lib/home-metrics';
import { seoMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = seoMetadata({
  title: 'CanRush для бизнеса',
  description: 'Кабинет для брендов энергетиков, дистрибьюторов и магазинов: аналитика отзывов и поиска, ответы от имени компании, разбор нейросетью, новые напитки в каталоге и продажи в маркете.',
  path: '/business',
});

const count = new Intl.NumberFormat('ru-RU');

/** Rounded down for the stats strip: «1 200+» reads as a fact, «1 237» as a counter. */
function roundDown(value: number) {
  if (value < 100) return count.format(value);
  const step = value < 1000 ? 50 : value < 10_000 ? 100 : 1000;
  return `${count.format(Math.floor(value / step) * step)}+`;
}

async function stats() {
  const [rows, groups] = await Promise.all([
    getPool().query<{ members: number; reviews: number }>(
      `select (select count(*) from "user" u where u.username is not null and not exists(select 1 from "userBlock" b where b."userId" = u.id))::int as members,
         (select count(*) from review)::int as reviews`).then(result => result.rows[0]).catch(() => undefined),
    loadAllCatalogGroups().catch(() => []),
  ]);
  return { members: rows?.members ?? 0, reviews: rows?.reviews ?? 0, drinks: groups.filter(isCountedCatalogDrink).length };
}

function Feature({ id, kicker, title, children, points, mock }: { id: string; kicker: string; title: ReactNode; children: ReactNode; points: string[]; mock: ReactNode }) {
  return <section className="biz-feature" id={id} aria-labelledby={`${id}-title`}>
    <div className="biz-mock" aria-hidden="true">{mock}<span className="biz-mock-note">Так выглядит в кабинете · пример данных</span></div>
    <div className="biz-feature-copy">
      <p className="biz-kicker">{kicker}</p>
      <h2 id={`${id}-title`}>{title}</h2>
      <p>{children}</p>
      <ul className="biz-points">{points.map(point => <li key={point}>{point}</li>)}</ul>
    </div>
  </section>;
}

const bar = (value: number) => ({ '--v': value }) as CSSProperties;
const THUMB = 'M7 10.5v9.5H4v-9.5zM7 10.5l3.6-6.6c1.5 0 2.5 1.2 2.2 2.6l-.6 3.5h6.1a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 17.1 20H7';
const Icon = ({ d, flip }: { d: string; flip?: boolean }) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d={d} transform={flip ? 'rotate(180 12 12)' : undefined} /></svg>;

/** A small radar like the cabinet's «Профиль оценок»: the drink (filled) against the catalog average (dashed). */
function MiniRadar({ drink, catalog }: { drink: number[]; catalog: number[] }) {
  const point = (value: number, index: number, total: number) => {
    const angle = -Math.PI / 2 + index * 2 * Math.PI / total;
    return `${Math.round((60 + Math.cos(angle) * 48 * value) * 10) / 10},${Math.round((60 + Math.sin(angle) * 48 * value) * 10) / 10}`;
  };
  const shape = (values: number[]) => values.map((value, index) => point(value, index, values.length)).join(' ');
  return <svg className="biz-radar" viewBox="0 0 120 120">
    {[1, .66, .33].map(level => <polygon key={level} points={shape(drink.map(() => level))} className="biz-radar-grid" />)}
    <polygon points={shape(catalog)} className="biz-radar-catalog" />
    <polygon points={shape(drink)} className="biz-radar-drink" />
  </svg>;
}

/**
 * «CanRush для бизнеса»: the landing for brands, distributors and shops. Every feature block describes what the cabinet
 * already does (its screens are drawn in the cabinet's look, with example data, and say so); what is not built yet
 * sits apart under «Скоро». The numbers in the strip are live.
 */
export default async function BusinessPage() {
  const [session, numbers] = await Promise.all([auth.api.getSession({ headers: await headers() }), stats()]);
  const start = session ? { href: '/business/cabinet', label: 'Открыть кабинет' } : { href: '/sign-in?for=business', label: 'Подключить компанию' };
  const cta = (secondary?: boolean) => <Link className={`biz-button${secondary ? ' is-light' : ''}`} href={start.href}>{start.label}</Link>;
  return <BrandShell headerAction={<ProfileNavigation active="business" />}>
    <div className="biz">
      <header className="biz-hero">
        <div className="biz-hero-copy">
          <p className="biz-badge">CanRush для бизнеса</p>
          <h1>Ваш энергетик&nbsp;— там, где его выбирают</h1>
          <p className="biz-lead">Кабинет для брендов, дистрибьюторов и магазинов: что говорят о ваших напитках и как их ищут, ответы покупателям от имени бренда — плюс новые вкусы в каталоге и продажи в маркете.</p>
          <div className="biz-actions">
            {cta()}
            <a className="biz-button is-ghost" href="#features">Что умеет кабинет</a>
          </div>
        </div>
        <div className="biz-hero-art">
          <Image src="/brand/home/business.png" width={443} height={480} alt="" priority sizes="(max-width: 959px) 70vw, 420px" />
          <div className="biz-float is-top" aria-hidden="true"><b>+12</b><small>новых отзывов за неделю</small></div>
          <div className="biz-float is-bottom" aria-hidden="true"><span className="biz-float-icon"><Icon d={THUMB} /></span><small>Хвалят</small><b>Сочный вкус</b></div>
        </div>
      </header>

      <ul className="biz-stats" aria-label="CanRush в цифрах">
        <li><b>{roundDown(numbers.members)}</b><span>участников<br />с профилем</span></li>
        <li><b>{roundDown(numbers.reviews)}</b><span>отзывов<br />на напитки</span></li>
        <li><b>{roundDown(numbers.drinks)}</b><span>энергетиков<br />в каталоге</span></li>
        <li><b>{CITIES.length}</b><span>городов<br />с ценами</span></li>
      </ul>

      <div className="biz-features" id="features">
        <Feature id="reviews" kicker="Аналитика отзывов" title={<>Как оценивают ваши<br />напитки — и рынок</>}
          points={['Отзывы за 30 дней и изменение к прошлому периоду', 'Динамика по неделям за три месяца', 'Профиль оценок против среднего по каталогу', 'Все отзывы с поиском, фильтром и выгрузкой в CSV']}
          mock={<div className="biz-card">
            <div className="biz-kpis">
              <div><b>48</b><small>за 30 дней</small><i>+20%</i></div>
              <div><b>8,4</b><small>вкус</small></div>
              <div><b>7,9</b><small>дизайн</small></div>
            </div>
            <div className="biz-card-split">
              <div className="biz-spark">{[3, 4, 3.5, 5, 4.5, 6, 5.5, 7, 6.5, 8, 7.5, 9].map((value, index) => <span key={index} style={bar(value / 9)} />)}</div>
              <MiniRadar drink={[.84, .79, .72, .6, .55]} catalog={[.7, .68, .5, .45, .4]} />
            </div>
          </div>}>
          Отзывы на подтверждённые напитки компании собираются в одном месте: средние оценки вкуса и дизайна, доля восьмёрок и выше, свайпы в дейтинге и повторные банки в календаре участников.
        </Feature>

        <Feature id="insights" kicker="Разбор нейросетью" title={<>Что хвалят, на что<br />жалуются, что сделать</>}
          points={['Обновляется сам, когда приходят новые отзывы', 'Читает только текст и оценки — без имён авторов', 'Советы бренду видите только вы']}
          mock={<div className="biz-card">
            <div className="biz-card-head"><span className="biz-can" /><div><strong>Ваш бренд · Манго</strong><small>по 48 отзывам</small></div></div>
            <div className="biz-insight" data-tone="brand"><p><span><Icon d={THUMB} /></span>Хвалят</p><div className="biz-chips"><span>Сочный вкус</span><span>Не приторный</span><span>Яркая банка</span></div></div>
            <div className="biz-insight" data-tone="muted"><p><span><Icon d={THUMB} flip /></span>Жалуются</p><div className="biz-chips"><span>Мало газа</span><span>Нет в Магните</span></div></div>
            <div className="biz-insight" data-tone="brand"><p><span><Icon d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3Z" /></span>Что сделать</p><div className="biz-chips"><span>Версия без сахара</span></div></div>
          </div>}>
          Десятки отзывов превращаются в короткую выжимку по каждому напитку. Выжимка — подсказка, а не факт: сами отзывы всегда под рукой.
        </Feature>

        <Feature id="search" kicker="Аналитика поиска" title={<>Как вас ищут<br />и где не находят</>}
          points={['Сколько раз бренд был в выдаче и сколько раз его назвали в запросе', 'Частые запросы за 30 дней по каталогу, магазинам и маркету', 'Запросы с вашим брендом, по которым ничего не нашлось']}
          mock={<div className="biz-card">
            <div className="biz-card-row"><strong>Частые запросы</strong><small>30 дней</small></div>
            <ul className="biz-queries">{[['ваш бренд манго', '124'], ['манго без сахара', '86'], ['ваш бренд цена', '41']].map(([query, value]) => <li key={query}><span>«{query}»</span><b>{value}</b></li>)}</ul>
            <div className="biz-missed"><small>Искали и не нашли</small><span>«ваш бренд юдзу» · 12</span></div>
          </div>}>
          Каждый поиск на CanRush учитывается обезличенно — без имён и аккаунтов. Видно спрос на бренд и вкусы, которых участники ждут, но не находят.
        </Feature>

        <Feature id="replies" kicker="Ответы от имени компании" title={<>Отвечайте на отзывы<br />голосом бренда</>}
          points={['Ответ под отзывом с логотипом и отметкой «Компания»', 'Автор отзыва получает уведомление', 'Удалить или скрыть чужой отзыв нельзя — только ответить']}
          mock={<div className="biz-card">
            <div className="biz-review"><span className="biz-avatar">М</span><div><strong>maks_energy</strong><p>Вкус топ, но в Магните третью неделю нет</p></div></div>
            <div className="biz-review is-brand"><span className="biz-avatar is-brand">B</span><div><strong>Ваш бренд <i>Компания</i></strong><p>Спасибо! Поставки в Магнит вернутся на следующей неделе.</p></div></div>
          </div>}>
          Отвечает владелец или команда прямо из таблицы отзывов в кабинете: благодарность, ответ на вопрос или где купить. Недовольный покупатель видит, что его услышали.
        </Feature>

        <Feature id="brand" kicker="Бренд целиком" title={<>Вся линейка<br />на одном экране</>}
          points={['Все вкусы бренда из каталога, даже не прикреплённые', 'Средняя оценка и число отзывов у каждого', 'Свайпы «нравится» и «пропустить» в дейтинге напитков']}
          mock={<div className="biz-card">
            <ul className="biz-lineup">{[['Манго', '8,4', .78], ['Классика', '8,1', .7], ['Без сахара', '7,6', .61], ['Юдзу', '7,2', .52]].map(([name, score, likes]) => <li key={name as string}>
              <span className="biz-can is-small" /><strong>{name}</strong><span className="biz-like"><span style={bar(likes as number)} /></span><b>{score}</b>
            </li>)}</ul>
          </div>}>
          Какой вкус тянет линейку, а какой пролистывают: оценки из отзывов рядом с тем, как напитки свайпают в дейтинге.
        </Feature>

        <Feature id="drinks" kicker="Новые напитки" title={<>Новинка в каталоге<br />в день запуска</>}
          points={['Прикрепите свои напитки из каталога — после проверки', 'Новый вкус — пошаговая заявка с фото, объёмами и составом', 'Карточка сразу попадает в тирлисты, дейтинг и рекомендации']}
          mock={<div className="biz-card">
            <div className="biz-card-head"><span className="biz-can is-new" /><div><strong>Ваш бренд · Юдзу</strong><small>330 и 450 мл · без сахара</small></div></div>
            <ol className="biz-steps-mini"><li className="is-done">Заявка</li><li className="is-done">Проверка</li><li className="is-current">В каталоге</li></ol>
          </div>}>
          Добавляйте напитки сами: модератор сверит фото и название, и участники смогут оценить новинку, добавить в избранное и отметить в календаре.
        </Feature>

        <Feature id="market" kicker="Продажи в маркете" title={<>Продавайте напрямую<br />без посредников</>}
          points={['Объявление за пять шагов с превью', 'Остаток банок резервируется под заказ', 'Заказы и переписка с покупателями — прямо в кабинете']}
          mock={<div className="biz-card">
            <div className="biz-card-head"><span className="biz-can" /><div><strong>Лимитка · 12 банок</strong><small>149 ₽ за банку</small></div></div>
            <div className="biz-order"><span className="biz-status">Новый заказ</span><span>3 банки · Москва</span></div>
            <div className="biz-order"><span className="biz-status is-done">Завершён</span><span>6 банок · Казань</span></div>
          </div>}>
          Лимитки, наборы и редкие вкусы находят своих покупателей. Оплату и доставку вы согласуете с покупателем в переписке — CanRush не принимает платежи.
        </Feature>

        <Feature id="team" kicker="Команда и уведомления" title={<>Новый отзыв —<br />вы узнаёте сразу</>}
          points={['Приглашайте коллег по почте или нику', 'Уведомления о новых отзывах на сайте, в Telegram и в приложении', 'Логотип компании и светлая или тёмная тема кабинета']}
          mock={<div className="biz-card">
            <div className="biz-notice"><span className="biz-avatar is-brand">C</span><div><strong>Новый отзыв · Ваш бренд, Манго</strong><small>Вкус 9 · дизайн 8 — «Лучший манго, что пробовал»</small></div></div>
            <div className="biz-team"><span className="biz-avatar is-brand">В</span><span className="biz-avatar">А</span><span className="biz-avatar">М</span><span className="biz-invite">+ Пригласить</span></div>
          </div>}>
          Кабинет ведёт вся команда: владелец приглашает коллег, они видят аналитику и разбор, а данные компании меняет только владелец.
        </Feature>
      </div>

      <section className="biz-soon" aria-labelledby="soon-title">
        <h2 id="soon-title">Скоро</h2>
        <ul>
          <li><b>Продвижение</b><span>Место в каталоге, рекомендациях и историях для тех, кому нравятся похожие вкусы. Всегда с пометкой «Реклама».</span></li>
        </ul>
      </section>

      <section className="biz-start" aria-labelledby="start-title">
        <h2 id="start-title">Как подключиться</h2>
        <ol>
          <li><b>1</b><div><strong>Войдите как бизнес</strong><span>Своим аккаунтом CanRush — через почту или Telegram.</span></div></li>
          <li><b>2</b><div><strong>Расскажите о компании</strong><span>Бренд, дистрибьютор или магазин, и как с вами связаться.</span></div></li>
          <li><b>3</b><div><strong>Прикрепите напитки</strong><span>После проверки компании откроются аналитика, разбор и команда.</span></div></li>
        </ol>
      </section>

      <section className="biz-faq" aria-labelledby="faq-title">
        <h2 id="faq-title">Частые вопросы</h2>
        <details><summary>Кто может подключиться?</summary><p>Производители энергетиков, дистрибьюторы и магазины — офлайн и онлайн.</p></details>
        <details><summary>Как вы проверяете компанию?</summary><p>Вручную: связываемся через официальные контакты бренда или магазина. Напитки компании тоже проверяются по одному — так аналитика видна только настоящему владельцу бренда.</p></details>
        <details><summary>Откуда данные в аналитике?</summary><p>Из отзывов, избранного, календаря выпитого и дейтинга участников CanRush, а поиск — из обезличенной истории запросов: без имён, аккаунтов и адресов. Отзывы заблокированных участников в расчёт не входят.</p></details>
        <details><summary>Можно убрать плохой отзыв?</summary><p>Нет. Отзывы принадлежат участникам. Нарушения правил разбирают модераторы — так же, как для всех.</p></details>
        <details><summary>Сколько это стоит?</summary><p>Условия обсуждаем лично — напишите на hello@canrush.ru.</p></details>
      </section>

      <section className="biz-final">
        <h2>Начнём с вашего бренда?</h2>
        <p>Войдите как бизнес и расскажите о компании — или напишите нам.</p>
        <div className="biz-actions">{cta(true)}<a className="biz-button is-outline" href="mailto:hello@canrush.ru">hello@canrush.ru</a></div>
      </section>
    </div>
  </BrandShell>;
}
