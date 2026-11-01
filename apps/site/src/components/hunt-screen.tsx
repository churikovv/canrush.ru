'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { claimHuntAction, orderHuntAction, type HuntState } from '@/app/hunt/actions';
import { ActionToast } from '@/components/action-toast';
import { CardIcon, MugIcon, ShirtIcon, TagIcon } from '@/components/hunt-icons';
import Link from '@/components/navigation-progress';
import { TurnScene } from '@/components/turn-scene';
import { pluralRu } from '@/lib/drink-calendar-fields';
import { HUNT_ITEMS, HUNT_LOOP_SECONDS, HUNT_ORDER_STATUS, HUNT_STAGES, HUNT_TAG_FORMS, HUNT_TASKS, huntFirstDay, huntItemName, huntLastDay, huntMinCashout, huntStage, huntStageOpensAt, type HuntOrderInput } from '@/lib/hunt-fields';
import { storeGaps, type HuntLevelView, type HuntStoreView, type HuntView } from '@/lib/hunt-gaps';

const NO_NOTICE = {};
const SEEN_KEY = 'canrush-hunt-stage';
const ITEM_ICONS: Record<string, ReactNode> = { rub: <CardIcon />, tshirt: <ShirtIcon />, mug: <MugIcon /> };

const number = (value: number) => value.toLocaleString('ru-RU');
const tags = (value: number) => `${number(value)} ${pluralRu(value, ...HUNT_TAG_FORMS)}`;
const levelState = (level: HuntLevelView) => (level.claimed ? 'claimed' : level.reached ? 'ready' : 'locked');
const CHECK = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>;
const LOCK = <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5Zm3 8H9V7a3 3 0 0 1 6 0v3Z" /></svg>;

/** Лист поверх сцены: системное «назад» на телефоне и Escape закрывают его как обычное окно. */
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const box = dialog.current; if (box && !box.open) box.showModal(); }, []);
  return <dialog ref={dialog} className="hunt-sheet" aria-label={title} onClose={onClose} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
    <div className="hunt-sheet-panel">
      <header className="hunt-sheet-head"><h2>{title}</h2><button type="button" className="can-plate pass-icon-btn" onClick={() => dialog.current?.close()} aria-label="Закрыть"><span aria-hidden="true">×</span></button></header>
      <div className="hunt-sheet-body">{children}</div>
    </div>
  </dialog>;
}

function StoreRow({ store }: { store: HuntStoreView }) {
  const gaps = storeGaps(store);
  const waiting = store.status === 'pending';
  return <li className="hunt-store">
    <span className="hunt-store-copy">
      <b>{store.name}</b>
      <small>{waiting ? 'На проверке' : store.earned > 0 ? `Принёс ${tags(store.earned)}` : gaps.length ? `Не хватает: ${gaps.join(', ')}` : 'Полный. Отправьте на проверку после правки'}</small>
    </span>
    {!waiting && store.earned === 0 && <Link className="hunt-store-edit" href={`/market/stores/${store.id}/edit`}>Дополнить</Link>}
  </li>;
}

function TasksSheet({ hunt, signedIn, onClose }: { hunt: HuntView; signedIn: boolean; onClose: () => void }) {
  return <Sheet title="Задания" onClose={onClose}>
    <ol className="hunt-tasks">
      {HUNT_TASKS.map(task => <li key={task.key} className="can-plate hunt-task"><span className="hunt-task-copy"><b>{task.title}</b><small>{task.hint}</small></span><strong><TagIcon size={18} />+{task.amount}</strong></li>)}
    </ol>
    <p className="hunt-sheet-note">Ценники начисляются за каждый магазин, когда он проходит проверку команды. За 5, 10, 15 и 20 магазинов идёт бонус к сумме. За событие один участник получает до {number(hunt.event.memberLimit)} ценников. Дубли, выдуманные точки и магазины своей компании не считаются.</p>
    {hunt.phase === 'open' && <Link className="can-btn hunt-wide" href="/market/stores/new">Добавить магазин</Link>}
    {signedIn && hunt.stores.length > 0 && <section aria-labelledby="hunt-own"><h3 id="hunt-own">Ваши магазины</h3><ul className="hunt-stores">{hunt.stores.map(store => <StoreRow key={store.id} store={store} />)}</ul></section>}
  </Sheet>;
}

function ShopSheet({ hunt, signedIn, pending, onOrder, onClose }: { hunt: HuntView; signedIn: boolean; pending: boolean; onOrder: (input: HuntOrderInput) => void; onClose: () => void }) {
  const least = huntMinCashout(hunt.phase);
  const [amount, setAmount] = useState(String(Math.max(least, hunt.balance)));
  const [method, setMethod] = useState<'sbp' | 'card'>('sbp');
  const [phone, setPhone] = useState('');
  const [bank, setBank] = useState('');
  const [card, setCard] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const open = hunt.orders.some(order => order.status === 'new');
  const enough = hunt.balance >= least;
  const exchanging = hunt.phase === 'open' || hunt.phase === 'exchange';
  function submit(event: FormEvent) {
    event.preventDefault();
    onOrder({ item: 'rub', amount: Number(amount), confirmed, payout: method === 'sbp' ? { method, phone, bank } : { method, number: card } });
  }
  return <Sheet title="Витрина наград" onClose={onClose}>
    <p className="can-plate hunt-balance"><TagIcon size={24} /><b>{tags(hunt.balance)}</b><small>1 ценник = 1 ₽</small></p>
    {exchanging && <p className="hunt-sheet-note">Обменяйте ценники до {huntLastDay(hunt.event.burnsAt)} включительно: потом они сгорят.</p>}
    <ul className="hunt-items">
      {HUNT_ITEMS.map(item => <li key={item.key} className="can-plate hunt-item" data-soon={item.soon || undefined}>
        <span className="hunt-item-art">{ITEM_ICONS[item.key] ?? <TagIcon size={44} />}</span>
        <span className="hunt-item-copy"><b>{item.name}</b><small>{item.line}</small></span>
        {item.kind === 'goods' && !item.soon && item.price && <button type="button" className="can-btn hunt-wide" disabled={!signedIn || !exchanging || pending || open || hunt.balance < item.price} onClick={() => onOrder({ item: item.key })}>{tags(item.price)}</button>}
      </li>)}
    </ul>
    {!signedIn ? <Link className="can-btn hunt-wide" href="/sign-in">Войти и участвовать</Link>
      : hunt.phase === 'over' ? <p className="hunt-sheet-note">Событие завершено, ценники сгорели.</p>
        : open ? <p className="hunt-sheet-note">Заявка в работе: выплатим в течение 30 дней. Новую можно отправить после неё.</p>
          : <form className="hunt-cash" onSubmit={submit}>
            <label><span>Сколько обменять на рубли</span><input type="number" inputMode="numeric" min={least} max={Math.max(hunt.balance, least)} step={1} value={amount} disabled={!enough} onChange={event => setAmount(event.target.value)} /></label>
            <fieldset className="hunt-method" disabled={!enough}>
              <legend>Куда перевести</legend>
              <label><input type="radio" name="hunt-method" checked={method === 'sbp'} onChange={() => setMethod('sbp')} /><span>СБП</span></label>
              <label><input type="radio" name="hunt-method" checked={method === 'card'} onChange={() => setMethod('card')} /><span>Карта</span></label>
            </fieldset>
            {method === 'sbp' ? <>
              <label><span>Телефон</span><input type="tel" inputMode="tel" autoComplete="tel" placeholder="+7 900 000-00-00" value={phone} disabled={!enough} onChange={event => setPhone(event.target.value)} /></label>
              <label><span>Банк</span><input type="text" autoComplete="off" maxLength={60} placeholder="Куда придёт перевод" value={bank} disabled={!enough} onChange={event => setBank(event.target.value)} /></label>
            </> : <label><span>Номер карты</span><input type="text" inputMode="numeric" autoComplete="cc-number" maxLength={23} placeholder="0000 0000 0000 0000" value={card} disabled={!enough} onChange={event => setCard(event.target.value)} /></label>}
            <label className="hunt-check"><input type="checkbox" checked={confirmed} disabled={!enough} onChange={event => setConfirmed(event.target.checked)} /><span>Мне есть 18 лет, с <Link href="/hunt/rules">условиями</Link> согласен.</span></label>
            <button type="submit" className="can-btn hunt-wide" disabled={pending || !enough || !confirmed}>{enough ? `Получить ${number(Number(amount) || 0)} ₽` : `Обмен от ${number(least)} ценников`}</button>
            <p className="hunt-sheet-note">Выплатим в течение 30 дней. Реквизиты шифруем и стираем сразу после выплаты. Срок карты и CVC не нужны: никому их не сообщайте.</p>
          </form>}
    {hunt.orders.length > 0 && <section aria-labelledby="hunt-orders"><h3 id="hunt-orders">Ваши заявки</h3><ul className="hunt-orders">{hunt.orders.map(order => <li key={order.id}>
      <span className="hunt-store-copy"><b>{huntItemName(order.item)} · {tags(order.amount)}</b><small>{order.createdAt}{order.note ? ` · ${order.note}` : ''}</small></span>
      <span className="hunt-order-status" data-status={order.status}>{HUNT_ORDER_STATUS[order.status]}</span>
    </li>)}</ul></section>}
  </Sheet>;
}

/** Охота за ценниками отдельным экраном, как сезонный пропуск: событие со сроком, магазин растёт с числом магазинов, награды забираются кнопкой. */
export function HuntScreen({ initial, signedIn }: { initial: HuntView; signedIn: boolean }) {
  const router = useRouter();
  const [hunt, setHunt] = useState(initial);
  const [picked, setPicked] = useState<number | null>(null);
  const [flash, setFlash] = useState(0);
  const [sheet, setSheet] = useState<'tasks' | 'shop' | null>(null);
  const [notice, setNotice] = useState<{ text: string; tone: 'success' | 'error'; host?: HTMLElement | null } | null>(null);
  const [pending, start] = useTransition();
  const rail = useRef<HTMLOListElement>(null);

  const level = picked ? hunt.levels[picked - 1] : undefined;
  const stage = huntStage(level ? level.level : hunt.reached);
  const info = HUNT_STAGES[stage - 1];
  const opened = level ? huntStageOpensAt(level.level) : undefined;
  const { progress, ready } = hunt;
  const { phase, event } = hunt;
  const collecting = phase === 'open' && hunt.limitLeft > 0;
  const subtitle = phase === 'upcoming' ? `Старт ${huntFirstDay(event.startsAt)}` : phase === 'open' ? `До ${huntLastDay(event.endsAt)} · ${collecting ? `до ${number(event.memberLimit)} ₽` : 'лимит получен'}` : phase === 'exchange' ? `Обмен до ${huntLastDay(event.burnsAt)}` : 'Событие завершено';

  useEffect(() => {
    const box = rail.current;
    const tile = box?.querySelector<HTMLElement>('[data-current]');
    if (box && tile) box.scrollLeft = tile.offsetLeft - (box.clientWidth - tile.offsetWidth) / 2;
  }, []);

  // Магазин вырос с прошлого визита — вспышка и тост. Браузер помнит только номер стадии.
  useEffect(() => {
    if (!signedIn) return;
    const timer = setTimeout(() => {
      try {
        const seen = localStorage.getItem(SEEN_KEY);
        const now = huntStage(initial.reached);
        localStorage.setItem(SEEN_KEY, String(now));
        if (seen !== null && Number(seen) < now) {
          setFlash(Date.now());
          setNotice({ text: `Магазин вырос: «${HUNT_STAGES[now - 1]?.name}»`, tone: 'success' });
        }
      } catch { /* нет доступа к хранилищу — просто без вспышки */ }
    }, 500);
    return () => clearTimeout(timer);
  }, [initial, signedIn]);

  function leave() {
    if (window.history.length > 1) router.back();
    else router.push('/market/stores');
  }

  function apply(response: HuntState, done: (state: Extract<HuntState, { hunt: HuntView }>) => string) {
    // Окно в верхнем слое перекрывает всё в body, поэтому тост рисуется внутри открытого листа.
    const host = document.querySelector<HTMLElement>('dialog.hunt-sheet[open]');
    if ('error' in response) { setNotice({ text: response.error, tone: 'error', host }); return; }
    setHunt(response.hunt);
    setNotice({ text: done(response), tone: 'success', host });
  }
  const claim = () => start(async () => apply(await claimHuntAction(), state => `Получено: ${tags(state.amount ?? 0)}`));
  const order = (input: HuntOrderInput) => start(async () => apply(await orderHuntAction(input), () => 'Заявка принята'));

  return <main className="pass-screen hunt-screen" data-stage={stage} data-no-pull>
    <TurnScene base="/brand/hunt/store" stages={HUNT_STAGES.length} seconds={HUNT_LOOP_SECONDS} stage={stage} flash={flash} />
    <header className="pass-top">
      <button type="button" className="can-plate pass-icon-btn" onClick={leave} aria-label="Назад"><span aria-hidden="true">‹</span></button>
      <div className="pass-title">
        <h1>Охота за ценниками</h1>
        <p>{subtitle}{collecting && <span className="hunt-each"> каждому</span>}</p>
      </div>
      {signedIn && <button type="button" className="can-plate pass-points hunt-points" onClick={() => setSheet('shop')} title="Ваши ценники"><TagIcon size={18} />{number(hunt.balance)}<span className="sr-only"> ценников, открыть витрину</span></button>}
    </header>

    <section className="pass-hero" aria-live="polite">
      {level ? <>
        <span className="pass-kicker">{level.stores} {pluralRu(level.stores, 'магазин', 'магазина', 'магазинов')}</span>
        <h2><TagIcon size={28} /> +{tags(level.amount)}</h2>
        <p>Бонус к сумме за магазины. {level.claimed ? 'Забран.' : level.reached ? 'Можно забрать.' : `Откроется на ${level.stores} магазинах.`}{opened ? ` Открывает «${opened.name}».` : ''}</p>
      </> : <>
        <span className="pass-kicker">Стадия {stage} из {HUNT_STAGES.length}</span>
        <h2>{info?.name}</h2>
        <p>{info?.line}</p>
      </>}
    </section>

    <section className="pass-action">
      {signedIn ? <div className="pass-progress">
        <span className="pass-progress-line"><b>Магазинов: {hunt.network}</b><small>{progress ? `до бонуса ещё ${progress.left}` : 'все бонусы открыты'}</small></span>
        <span className="can-meter" aria-hidden="true"><i style={{ '--share': progress ? progress.share : 1 } as CSSProperties} /></span>
      </div> : <p className="pass-guest">{collecting ? 'Платим за магазины: 20 ценников за полный и бонусы сверху, 1 ценник = 1 ₽.' : phase === 'upcoming' ? `Старт ${huntFirstDay(event.startsAt)}.` : 'Приём магазинов закрыт.'}</p>}
      {signedIn
        ? ready.count > 0
          ? <button type="button" className="can-btn pass-cta" data-ready="" disabled={pending} onClick={claim}>Забрать · {tags(ready.amount)}</button>
          : collecting && <Link className="can-btn pass-cta" href="/market/stores/new">Добавить магазин</Link>
        : collecting && <Link className="can-btn pass-cta" href="/sign-in">Войти и участвовать</Link>}
      <div className="hunt-menu">
        <button type="button" className="can-plate hunt-menu-btn" onClick={() => setSheet('tasks')}>Задания</button>
        <button type="button" className="can-plate hunt-menu-btn" onClick={() => setSheet('shop')}>Витрина наград</button>
      </div>
    </section>

    <div className="pass-rail-box">
      <ol className="pass-rail hunt-rail" ref={rail} tabIndex={0} aria-label="Бонусы за магазины">
        {hunt.levels.map(item => {
          const shop = huntStageOpensAt(item.level);
          return <li key={item.level} data-current={item.level === Math.min(hunt.reached + 1, hunt.levels.length) ? '' : undefined}>
            <button type="button" className="can-plate pass-tile" data-state={levelState(item)} aria-pressed={picked === item.level} onClick={() => setPicked(value => (value === item.level ? null : item.level))}>
              <span className="pass-tile-level">{item.stores}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <span className="pass-tile-reward">{shop ? <img className="hunt-tile-shop" src={`/brand/hunt/store-${huntStage(item.level)}-cutout.webp`} width={360} height={240} alt="" /> : <TagIcon size={26} />}</span>
              <b>+{item.amount}</b>
              {levelState(item) !== 'ready' && <span className="pass-tile-state">{item.claimed ? CHECK : LOCK}</span>}
              <span className="sr-only">ценников, {item.claimed ? 'забрано' : item.reached ? 'можно забрать' : 'ещё не открыто'}{shop ? `, новый магазин «${shop.name}»` : ''}</span>
            </button>
          </li>;
        })}
      </ol>
    </div>

    <p className="pass-note">{phase === 'over' ? 'Ценники этого события сгорели.' : `Ценники сгорят после ${huntLastDay(event.burnsAt)}, обменяйте их заранее.`} <Link href="/hunt/rules">Условия</Link></p>
    {sheet === 'tasks' && <TasksSheet hunt={hunt} signedIn={signedIn} onClose={() => setSheet(null)} />}
    {sheet === 'shop' && <ShopSheet hunt={hunt} signedIn={signedIn} pending={pending} onOrder={order} onClose={() => setSheet(null)} />}
    <ActionToast message={notice?.text} tone={notice?.tone} trigger={notice ?? NO_NOTICE} container={notice?.host} />
  </main>;
}
