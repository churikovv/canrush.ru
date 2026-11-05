'use client';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useMemo, useRef, useState, useTransition, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { answerTradeAction, cancelTradeAction, proposeTradeAction } from '@/app/gacha/trades/actions';
import { BottomSheet, BottomSheetHead } from '@/components/bottom-sheet';
import { CardInspector } from '@/components/card-inspector';
import Link from '@/components/navigation-progress';
import {
  OFFERS_PER_DAY, TRADE_LOCK_DAYS, TRADE_MAX_CARDS, TRADE_MIN_DAYS, TRADE_OFFER_HOURS, TRADE_TOLERANCE_PERCENT, TRADE_VALUE, TRADES_PER_DAY,
  balanceHint, tradeBalance,
} from '@/lib/card-trade-fields';
import type { TradeCard, TradeDesk, TradePlayer, TradeView } from '@/lib/card-trades';
import { days, pluralRu } from '@/lib/drink-calendar-fields';
import { RARITIES, RARITY_LABELS, rarityRank, type Rarity } from '@/lib/gacha-fields';
import type { ShownCard } from '@/components/big-card';

const cardKey = (card: { brand: string; flavor: string }) => `${card.brand}\u0000${card.flavor}`;
const cardsWord = (count: number) => `${count} ${pluralRu(count, 'карточка', 'карточки', 'карточек')}`;
const RARITY_PLURAL: Record<Rarity, string> = { common: 'Обычные', rare: 'Редкие', epic: 'Эпические', legendary: 'Легендарные' };
const SWAP = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 4 3 8l4 4M3 8h13M17 20l4-4-4-4M21 16H8" /></svg>;
const LOCK = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>;

/** The value of a card in a trade, as a small gem and a number: what the scales weigh. */
export function TradeValue({ value, label }: { value: number; label?: string }) {
  return <span className="trd-value" title="Ценность в обмене: обычная 1, редкая 3, эпическая 10, легендарная 30">
    <i aria-hidden="true" />{value}{label && <span className="sr-only"> {label}</span>}
  </span>;
}

export function TradeFace({ player, size = 40 }: { player: Pick<TradePlayer, 'name' | 'username' | 'avatarId'>; size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element -- a member's avatar from our own route, sized by the box.
  return <span className="trd-face" style={{ '--size': `${size}px` } as CSSProperties}>{player.avatarId ? <img src={`/api/profile-images/${player.avatarId}`} alt="" width={size} height={size} /> : <b aria-hidden="true">{(player.username ?? player.name).slice(0, 1).toUpperCase()}</b>}</span>;
}

/** The rules, the same on both screens. */
export function TradeRules({ sheet }: { sheet: RefObject<HTMLDialogElement | null> }) {
  return <BottomSheet ref={sheet} className="trd-rules" labelledBy="trd-rules-title">
    <BottomSheetHead id="trd-rules-title" title="Как меняться" onClose={() => sheet.current?.close()} />
    <ul className="trd-rules-list">
      <li><b>Только равный обмен.</b> У каждой карточки ценность по редкости: обычная — 1, редкая — 3, эпическая — 10, легендарная — 30. Стороны могут отличаться не больше чем на {TRADE_TOLERANCE_PERCENT}%: так коллекцию нельзя перелить с другого аккаунта в один конец.</li>
      <li><b>До {TRADE_MAX_CARDS} карточек с каждой стороны.</b> Можно отдать и последнюю копию — тогда она уйдёт из вашей коллекции.</li>
      <li><b>Ответ — за {days(TRADE_OFFER_HOURS / 24)}.</b> Потом предложение закрывается. С одним человеком открыто одно предложение, а меняться с ним можно раз в сутки.</li>
      <li><b>{TRADES_PER_DAY} {pluralRu(TRADES_PER_DAY, 'обмен', 'обмена', 'обменов')} в день.</b> Предложить можно до {OFFERS_PER_DAY} раз в сутки.</li>
      <li><b>Полученная карточка {days(TRADE_LOCK_DAYS)} не меняется дальше.</b> Осколков за полученный дубль нет.</li>
      <li><b>Аккаунту нужно {days(TRADE_MIN_DAYS)}.</b> Меняются участники с ником, которых не заблокировал сайт и которые не заблокировали друг друга.</li>
      <li><b>Только карточки на карточки.</b> Не на крышки, осколки, искры или деньги: у карточек нет цены вне сайта.</li>
    </ul>
  </BottomSheet>;
}

/** A small card in a list: the can on white, its rarity's border, the value and badges. */
function Tile({ card, selected, badges, onToggle }: { card: TradeCard; selected: boolean; badges: ReactNode; onToggle: () => void }) {
  const locked = Boolean(card.lockedUntil);
  return <button type="button" className="trd-tile motion-local" data-rarity={card.rarity} aria-pressed={selected} disabled={locked}
    title={locked ? `Получена в обмене: снова меняется с ${new Date(card.lockedUntil!).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}` : undefined}
    onClick={onToggle}>
    <span className="trd-tile-art"><Image src={card.cover} width={120} height={120} sizes="110px" unoptimized alt="" loading="lazy" draggable={false} /></span>
    <span className="trd-tile-name"><small>{card.brand}</small>{card.name}</span>
    <span className="trd-tile-foot"><TradeValue value={TRADE_VALUE[card.rarity]} label="ценность" />{locked ? <em className="is-lock">{LOCK}пауза</em> : badges}</span>
    {selected && <span className="trd-check" aria-hidden="true">✓</span>}
  </button>;
}

/** Small covers in a row: the summary of one side of a trade. Tapping one removes it, or opens it up close. */
function Thumbs({ cards, onTap, empty, label }: { cards: ShownCard[]; onTap?: (card: ShownCard) => void; empty: number; label: (card: ShownCard) => string }) {
  return <ul className="trd-thumbs">
    {cards.map(card => <li key={cardKey(card)}>
      <button type="button" className="trd-thumb motion-local" data-rarity={card.rarity} aria-label={label(card)} disabled={!onTap || !card.cover} onClick={() => onTap?.(card)}>
        {card.cover ? <Image src={card.cover} width={48} height={48} sizes="44px" unoptimized alt="" loading="lazy" /> : <b aria-hidden="true">?</b>}
      </button>
    </li>)}
    {Array.from({ length: Math.max(0, empty) }, (_, index) => <li key={`empty-${index}`} aria-hidden="true"><span className="trd-thumb is-empty" /></li>)}
  </ul>;
}

/** The scales: where the needle stands between the two sides, and the zone where a trade counts as fair. */
function Scales({ give, take }: { give: number; take: number }) {
  const big = Math.max(give, take);
  const tilt = big ? (take - give) / big : 0;
  const fair = big > 0 && give > 0 && take > 0 && Math.abs(give - take) * 100 <= big * TRADE_TOLERANCE_PERCENT;
  return <div className="trd-scales" data-fair={fair || undefined} style={{ '--tilt': tilt, '--zone': TRADE_TOLERANCE_PERCENT / 100 } as CSSProperties} aria-hidden="true">
    <span className="trd-scales-zone" /><span className="trd-scales-mid" /><span className="trd-scales-needle" />
  </div>;
}

type Filter = 'all' | Rarity | 'special';

/**
 * The trade builder with one member: what to get from their cards, what to give from yours, and the scales between.
 * The server checks the same rules again; here the button stays off until the sides weigh about the same.
 */
export function TradeBuilder({ partner, desk, backHref }: { partner: TradePlayer; desk: TradeDesk; backHref: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<'get' | 'give'>('get');
  const [filter, setFilter] = useState<Filter>('all');
  const [picked, setPicked] = useState<Record<'get' | 'give', string[]>>({ get: [], give: [] });
  const [error, setError] = useState('');
  const [sending, startSend] = useTransition();
  const rules = useRef<HTMLDialogElement>(null);
  const nick = `@${partner.username}`;

  const mineKeys = useMemo(() => new Set(desk.mine.map(cardKey)), [desk.mine]);
  const theirKeys = useMemo(() => new Set(desk.theirs.map(cardKey)), [desk.theirs]);
  const source = tab === 'get' ? desk.theirs : desk.mine;
  // The special filter: on «get» the cans you lack, on «give» your duplicates.
  const special = (card: TradeCard) => (tab === 'get' ? !mineKeys.has(cardKey(card)) : card.count > 1);
  const list = useMemo(() => source.filter(card => filter === 'all' || (filter === 'special' ? special(card) : card.rarity === filter))
    .sort((a, b) => Number(special(b)) - Number(special(a)) || rarityRank(b.rarity) - rarityRank(a.rarity) || a.brand.localeCompare(b.brand, 'ru') || a.name.localeCompare(b.name, 'ru')),
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `special` reads only `tab` and the key sets listed here.
  [source, filter, tab, mineKeys]);
  const rarities = RARITIES.filter(rarity => source.some(card => card.rarity === rarity)).reverse();

  const byKey = (cards: TradeCard[]) => new Map(cards.map(card => [cardKey(card), card]));
  const gets = picked.get.map(item => byKey(desk.theirs).get(item)).filter((card): card is TradeCard => Boolean(card));
  const gives = picked.give.map(item => byKey(desk.mine).get(item)).filter((card): card is TradeCard => Boolean(card));
  const balance = tradeBalance(gives.map(card => card.rarity), gets.map(card => card.rarity));
  const blocked = desk.refusal ?? (desk.open ? (desk.open.outgoing ? `Вы уже предложили ${nick} обмен — дождитесь ответа.` : `От ${nick} уже есть предложение — сначала ответьте на него.`) : null);

  function toggle(side: 'get' | 'give', card: TradeCard) {
    setError('');
    setPicked(current => {
      const key = cardKey(card);
      if (current[side].includes(key)) return { ...current, [side]: current[side].filter(item => item !== key) };
      if (current[side].length >= TRADE_MAX_CARDS) { setError(`Не больше ${TRADE_MAX_CARDS} карточек с каждой стороны.`); return current; }
      return { ...current, [side]: [...current[side], key] };
    });
  }
  function switchTab(next: 'get' | 'give') { setTab(next); setFilter('all'); }

  function send() {
    setError('');
    startSend(async () => {
      const result = await proposeTradeAction(partner.id, gives.map(({ brand, flavor }) => ({ brand, flavor })), gets.map(({ brand, flavor }) => ({ brand, flavor })));
      if ('error' in result) { setError(result.error); return; }
      router.push('/gacha/trades?tab=out&notice=sent');
    });
  }

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: 'all', label: 'Все', count: source.length },
    { key: 'special', label: tab === 'get' ? 'Новые для вас' : 'Дубли', count: source.filter(special).length },
    ...rarities.map(rarity => ({ key: rarity, label: RARITY_PLURAL[rarity], count: source.filter(card => card.rarity === rarity).length })),
  ];

  return <main className="inv-screen trd-screen" data-no-pull>
    <header className="inv-top">
      <Link className="can-plate inv-icon-btn" href={backHref} aria-label="Назад"><span aria-hidden="true">‹</span></Link>
      <TradeFace player={partner} size={36} />
      <div className="inv-title">
        <h1>Обмен</h1>
        <p>с {nick}</p>
      </div>
      <button type="button" className="can-plate inv-icon-btn trd-help" aria-label="Правила обмена" aria-haspopup="dialog" onClick={() => rules.current?.showModal()}>?</button>
    </header>

    <div className="trd-tabs" role="group" aria-label="Чьи карточки">
      <button type="button" aria-pressed={tab === 'get'} onClick={() => switchTab('get')}>Получу<b>{picked.get.length}</b></button>
      <button type="button" aria-pressed={tab === 'give'} onClick={() => switchTab('give')}>Отдам<b>{picked.give.length}</b></button>
    </div>

    <div className="inv-filters" role="toolbar" aria-label="Какие карточки показать">
      {filters.map(item => <button key={item.key} type="button" className="inv-chip" data-rarity={item.key !== 'all' && item.key !== 'special' ? item.key : undefined} aria-pressed={filter === item.key} onClick={() => setFilter(item.key)}>{item.label}<b>{item.count}</b></button>)}
    </div>

    <section className="trd-grid-wrap" aria-label={tab === 'get' ? `Карточки ${nick}` : 'Ваши карточки'}>
      {list.length ? <ul className="trd-grid">
        {list.map(card => {
          const key = cardKey(card);
          const badges = tab === 'get'
            ? !mineKeys.has(key) && <em>новая</em>
            : <>{card.count > 1 && <em>дубль</em>}{!theirKeys.has(key) && <em className="is-need" title={`У ${nick} такой карточки нет`}>им нужна</em>}</>;
          return <li key={key}><Tile card={card} selected={picked[tab].includes(key)} badges={badges} onToggle={() => toggle(tab, card)} /></li>;
        })}
      </ul> : <p className="trd-empty">{source.length ? 'Под этот фильтр карточек нет.' : tab === 'get' ? `У ${nick} пока нет карточек.` : 'У вас пока нет карточек: первая крутка в день — бесплатно.'}</p>}
    </section>

    <section className="trd-sum" aria-label="Ваше предложение">
      <div className="trd-sides">
        <div className="trd-side">
          <span className="trd-side-head">Отдаёте <TradeValue value={balance.give} label="ценность" /></span>
          <Thumbs cards={gives} empty={gives.length ? 0 : 1} onTap={card => toggle('give', card as TradeCard)} label={card => `Убрать ${card.brand} · ${card.name}`} />
        </div>
        <span className="trd-swap" aria-hidden="true">{SWAP}</span>
        <div className="trd-side">
          <span className="trd-side-head">Получаете <TradeValue value={balance.take} label="ценность" /></span>
          <Thumbs cards={gets} empty={gets.length ? 0 : 1} onTap={card => toggle('get', card as TradeCard)} label={card => `Убрать ${card.brand} · ${card.name}`} />
        </div>
      </div>
      <Scales give={balance.give} take={balance.take} />
      <p className="trd-hint" data-fair={balance.fair || undefined} role="status">{blocked ?? balanceHint(balance, gives.length, gets.length)}</p>
      {error && <p className="trd-hint is-error" role="alert">{error}</p>}
      {desk.open
        ? <Link className="can-btn trd-send" href={`/gacha/trades?tab=${desk.open.outgoing ? 'out' : 'in'}`}>К предложению</Link>
        : <button type="button" className="can-btn trd-send" disabled={Boolean(blocked) || !balance.fair || sending} onClick={send}>{sending ? 'Отправляем…' : 'Предложить обмен'}</button>}
    </section>

    <TradeRules sheet={rules} />
  </main>;
}

const STATUS: Record<TradeView['status'], string> = { open: '', accepted: 'Обмен состоялся', declined: 'Отклонено', cancelled: 'Отменено', expired: 'Без ответа' };
const timeLeft = (hours: number) => (hours >= 24 ? `ещё ${days(Math.round(hours / 24))}` : `ещё ${hours} ч`);

/** One trade on the trades screen: the partner, both sides with their value, and what the viewer can do with it. */
function Offer({ trade, onInspect }: { trade: TradeView; onInspect: (card: ShownCard) => void }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const give = trade.give.reduce((sum, card) => sum + TRADE_VALUE[card.rarity], 0);
  const get = trade.get.reduce((sum, card) => sum + TRADE_VALUE[card.rarity], 0);
  const nick = trade.partner.username ? `@${trade.partner.username}` : trade.partner.name;
  function run(work: () => Promise<{ error?: string }>, then?: string) {
    setError('');
    start(async () => {
      const result = await work();
      if (result.error) { setError(result.error); setConfirming(false); return; }
      // An accepted trade opens the history with a note: the offer itself leaves the list.
      if (then) router.replace(then); else router.refresh();
    });
  }
  const label = (card: ShownCard) => `${card.brand} · ${card.name}, ${RARITY_LABELS[card.rarity].toLowerCase()} — открыть крупно`;
  return <article className="trd-offer" data-status={trade.status}>
    <header className="trd-offer-head">
      {trade.partner.username ? <Link className="trd-offer-who" href={`/profile/${trade.partner.username}/cards`}><TradeFace player={trade.partner} size={36} /><b>{nick}</b></Link>
        : <span className="trd-offer-who"><TradeFace player={trade.partner} size={36} /><b>{nick}</b></span>}
      <span className="trd-offer-state">{trade.status === 'open' ? `${trade.outgoing ? 'Ждём ответа' : 'Ждёт вашего ответа'} · ${timeLeft(trade.hoursLeft ?? 1)}` : STATUS[trade.status]}</span>
    </header>
    <div className="trd-sides">
      <div className="trd-side">
        <span className="trd-side-head">{trade.status === 'accepted' ? 'Отдали' : 'Отдадите'} <TradeValue value={give} label="ценность" /></span>
        <Thumbs cards={trade.give} empty={0} onTap={onInspect} label={label} />
      </div>
      <span className="trd-swap" aria-hidden="true">{SWAP}</span>
      <div className="trd-side">
        <span className="trd-side-head">{trade.status === 'accepted' ? 'Получили' : 'Получите'} <TradeValue value={get} label="ценность" /></span>
        <Thumbs cards={trade.get} empty={0} onTap={onInspect} label={label} />
      </div>
    </div>
    {error && <p className="trd-hint is-error" role="alert">{error}</p>}
    {trade.status === 'open' && <div className="trd-offer-actions">
      {trade.outgoing
        ? <button type="button" className="trd-ghost" disabled={busy} onClick={() => run(() => cancelTradeAction(trade.id))}>{busy ? 'Отменяем…' : 'Отменить'}</button>
        : <>
          <button type="button" className="can-btn" disabled={busy} onClick={() => (confirming ? run(() => answerTradeAction(trade.id, true), '/gacha/trades?tab=done&notice=done') : setConfirming(true))}>
            {busy ? 'Меняемся…' : confirming ? `Отдать ${cardsWord(trade.give.length)}?` : 'Принять'}
          </button>
          <button type="button" className="trd-ghost" disabled={busy} onClick={() => (confirming ? setConfirming(false) : run(() => answerTradeAction(trade.id, false)))}>{confirming ? 'Не сейчас' : 'Отклонить'}</button>
        </>}
    </div>}
  </article>;
}

type DeskTab = 'in' | 'out' | 'done';

/** The trades screen: offers to answer, own offers waiting, the latest finished ones, and whom to trade with. */
export function TradesScreen({ trades, partners, backHref, initialTab, notice }: {
  trades: TradeView[]; partners: (TradePlayer & { cards: number })[]; backHref: string; initialTab: DeskTab | null; notice: 'sent' | 'done' | null;
}) {
  const incoming = trades.filter(trade => trade.status === 'open' && !trade.outgoing);
  const outgoing = trades.filter(trade => trade.status === 'open' && trade.outgoing);
  const done = trades.filter(trade => trade.status !== 'open');
  const [tab, setTab] = useState<DeskTab>(initialTab ?? (incoming.length ? 'in' : outgoing.length ? 'out' : 'in'));
  const [inspecting, setInspecting] = useState<ShownCard | null>(null);
  const rules = useRef<HTMLDialogElement>(null);
  const shown = tab === 'in' ? incoming : tab === 'out' ? outgoing : done;
  const tabs: { key: DeskTab; label: string; count: number }[] = [
    { key: 'in', label: 'Входящие', count: incoming.length },
    { key: 'out', label: 'Исходящие', count: outgoing.length },
    { key: 'done', label: 'История', count: done.length },
  ];
  const empty: Record<DeskTab, string> = {
    in: 'Пока никто не предложил обмен.',
    out: 'Вы пока ничего не предложили.',
    done: 'Здесь будут состоявшиеся и закрытые обмены.',
  };

  return <main className="inv-screen trd-screen trd-desk" data-no-pull>
    <header className="inv-top">
      <Link className="can-plate inv-icon-btn" href={backHref} aria-label="Назад"><span aria-hidden="true">‹</span></Link>
      <div className="inv-title">
        <h1>Обмены</h1>
        <p>Карточки Банкомата — на равных</p>
      </div>
      <button type="button" className="can-plate inv-icon-btn trd-help" aria-label="Правила обмена" aria-haspopup="dialog" onClick={() => rules.current?.showModal()}>?</button>
    </header>

    <div className="trd-tabs is-three" role="group" aria-label="Обмены">
      {tabs.map(item => <button key={item.key} type="button" aria-pressed={tab === item.key} onClick={() => setTab(item.key)}>{item.label}<b>{item.count}</b></button>)}
    </div>

    <div className="trd-desk-body">
      {notice === 'sent' && tab === 'out' && <p className="trd-sent" role="status">Предложение отправлено — ответ придёт уведомлением.</p>}
      {notice === 'done' && tab === 'done' && <p className="trd-sent" role="status">Обмен состоялся — карточки уже в коллекции.</p>}
      {shown.length ? <div className="trd-offers">{shown.map(trade => <Offer key={trade.id} trade={trade} onInspect={setInspecting} />)}</div>
        : <p className="trd-empty">{empty[tab]}</p>}

      <section className="trd-partners" aria-labelledby="trd-partners-title">
        <h2 id="trd-partners-title">С кем поменяться</h2>
        <p>Откройте коллекцию участника и нажмите «Обмен». Здесь — те, на кого вы подписаны.</p>
        {partners.length ? <ul>
          {partners.map(player => <li key={player.id}>
            <Link href={`/profile/${player.username}/cards/trade`}><TradeFace player={player} size={44} /><b>@{player.username}</b><span>{cardsWord(player.cards)}</span></Link>
          </li>)}
        </ul> : <p className="trd-empty is-small">Подпишитесь на участников — и они появятся здесь.</p>}
      </section>
    </div>

    <TradeRules sheet={rules} />
    {inspecting && <CardInspector card={inspecting} onClose={() => setInspecting(null)} />}
  </main>;
}
