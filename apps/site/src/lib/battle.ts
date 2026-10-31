import { randomInt, randomUUID } from 'node:crypto';
import { getPool } from '@/db/pool';
import {
  applyAction, battleView, botAction, createBattle, type BattleAction, type BattleEvent, type BattleState, type BattleView, type Side,
} from '@/lib/battle-engine';
import {
  DECK_SIZE, PAID_WINS_PER_DAY, PLAIN_STATS, SPIN_RING_COST, STARTER_CARDS, WIN_RINGS, battleStats, buildDeck, cardValue,
  type BattleCardDef, type BattleKeyword, type BattleStats, type DrinkFacts,
} from '@/lib/battle-fields';
import { moscowDay } from '@/lib/drink-calendar-fields';
import { gachaPool, getGachaState, ringsOf, type GachaDrink, type GachaState } from '@/lib/gacha';

export class BattleError extends Error {}

const key = (brand: string, flavor: string) => JSON.stringify([brand, flavor]);
const dayStart = `(((now() at time zone 'Europe/Moscow')::date)::timestamp at time zone 'Europe/Moscow')`;

interface Queryable { query: ReturnType<typeof getPool>['query'] }

/** Что сайт знает о напитках пула. Отзывы заблокированных не считаются; трекер сюда не входит намеренно. */
async function drinkFacts(drinks: readonly GachaDrink[]): Promise<DrinkFacts[]> {
  const pool = getPool();
  const [reviews, swipes, favorites, tiers] = await Promise.all([
    pool.query<{ brand: string; flavor: string; n: number; taste: number; design: number }>(`select brand, flavor, count(*)::int n, avg(taste)::float taste, avg(design)::float design
      from review r where not exists(select 1 from "userBlock" b where b."userId" = r."userId") group by 1, 2`),
    pool.query<{ brand: string; flavor: string; n: number; likes: number }>(`select brand, flavor, count(*)::int n, avg(liked::int)::float likes
      from "drinkSwipe" s where not exists(select 1 from "userBlock" b where b."userId" = s."userId") group by 1, 2`),
    pool.query<{ brand: string; flavor: string; n: number }>('select brand, flavor, count(*)::int n from favorite group by 1, 2'),
    pool.query<{ brand: string; flavor: string; n: number; average: number }>(`select i.brand, i.flavor, count(*)::int n,
        avg(case i.tier when 'SS' then 6 when 'S' then 5 when 'A' then 4 when 'B' then 3 when 'C' then 2 else 1 end)::float average
      from "tierListItem" i join "tierList" l on l.id = i."tierListId" where l.status = 'published' group by 1, 2`),
  ]);
  const index = <T extends { brand: string; flavor: string }>(rows: T[]) => new Map(rows.map(row => [key(row.brand, row.flavor), row]));
  const [byReview, bySwipe, byFavorite, byTier] = [index(reviews.rows), index(swipes.rows), index(favorites.rows), index(tiers.rows)];
  return drinks.map(drink => {
    const id = key(drink.brand, drink.flavor);
    const review = byReview.get(id), swipe = bySwipe.get(id), tier = byTier.get(id);
    return {
      price: drink.price ?? null, reviews: review?.n ?? 0, taste: review?.taste ?? 0, design: review?.design ?? 0,
      swipes: swipe?.n ?? 0, likes: swipe?.likes ?? 0, favorites: byFavorite.get(id)?.n ?? 0,
      tierLists: tier?.n ?? 0, tierAverage: tier?.average ?? 0, sugarfree: drink.flavor.includes('sugarfree'),
    };
  });
}

type StoredStats = BattleStats & { brand: string; flavor: string };

/** Числа сезона: первый запрос месяца считает их и кладёт в базу, дальше они не меняются до следующего месяца. */
async function seasonStats(season: string, drinks: readonly GachaDrink[]): Promise<StoredStats[]> {
  const read = async () => (await getPool().query<StoredStats>('select brand, flavor, cost, attack, health, keyword from "battleCardStat" where season = $1', [season])).rows;
  const stored = await read();
  if (stored.length || !drinks.length) return stored;
  const stats = battleStats(await drinkFacts(drinks));
  await getPool().query(`insert into "battleCardStat"(season, brand, flavor, cost, attack, health, keyword)
    select $1, * from unnest($2::text[], $3::text[], $4::smallint[], $5::smallint[], $6::smallint[], $7::text[]) on conflict do nothing`, [
    season, drinks.map(drink => drink.brand), drinks.map(drink => drink.flavor), stats.map(item => item.cost), stats.map(item => item.attack), stats.map(item => item.health), stats.map(item => item.keyword),
  ]);
  return read();
}

let catalogCache: { at: number; season: string; cards: BattleCardDef[] } | null = null;
const CATALOG_TTL = 10 * 60 * 1000;

/** Все карты боя: пул Банкомата с числами сезона. */
export async function battleCatalog(drinks?: GachaDrink[], now = Date.now()): Promise<BattleCardDef[]> {
  const season = moscowDay(new Date(now)).slice(0, 7);
  if (!drinks && catalogCache?.season === season && now - catalogCache.at < CATALOG_TTL) return catalogCache.cards;
  const pool = drinks ?? await gachaPool();
  const stats = new Map((await seasonStats(season, pool)).map(row => [key(row.brand, row.flavor), row]));
  const cards = pool.map(drink => {
    const row = stats.get(key(drink.brand, drink.flavor)) ?? PLAIN_STATS;
    return {
      id: `${drink.brand}|${drink.flavor}`, brand: drink.brand, flavor: drink.flavor, title: drink.brand, name: drink.name, cover: drink.cover,
      rarity: drink.rarity, cost: row.cost, attack: row.attack, health: row.health, keyword: row.keyword as BattleKeyword | null,
    };
  });
  if (!drinks) catalogCache = { at: now, season, cards };
  return cards;
}

/** Для тестов: следующий вызов соберёт карты заново. */
export function resetBattleCatalog() { catalogCache = null; }

async function ownedDeck(db: Queryable, userId: string, cards: readonly BattleCardDef[]): Promise<BattleCardDef[]> {
  const counts = new Map((await db.query<{ brand: string; flavor: string; count: number }>('select brand, flavor, count from "gachaCard" where "userId" = $1', [userId])).rows.map(row => [key(row.brand, row.flavor), row.count]));
  return buildDeck(cards.flatMap(card => { const count = counts.get(key(card.brand, card.flavor)); return count ? [{ ...card, count }] : []; }));
}

/** Соперник берёт случайные банки той же стоимости: кривая как у участника, а числа средние по каталогу. */
function rivalDeck(deck: readonly BattleCardDef[], cards: readonly BattleCardDef[]): BattleCardDef[] {
  return deck.map(card => {
    const same = cards.filter(item => item.cost === card.cost);
    return same.length ? same[randomInt(same.length)]! : STARTER_CARDS.find(item => item.cost === card.cost) ?? card;
  });
}

const battleOutcome = (winner: Side) => (winner === 'me' ? 'won' : 'lost');

export interface BattleReward { won: boolean; earned: number; rings: number; paidLeft: number }
export interface BattleFrame { event: BattleEvent | { kind: 'surrender' }; view: BattleView }
export interface BattleMove { frames: BattleFrame[]; reward: BattleReward | null }
export interface BattleOpen { id: string; view: BattleView }
export interface BattleHome {
  battle: BattleOpen | null; deck: BattleCardDef[]; /** Своих карт в колоде */ own: number; rings: number; paidLeft: number; blocked: boolean;
}

async function paidToday(db: Queryable, userId: string) {
  return (await db.query<{ n: number }>(`select count(*)::int n from "ringLedger" where "userId" = $1 and reason = 'battle' and "createdAt" >= ${dayStart}`, [userId])).rows[0]?.n ?? 0;
}

/** Главный экран боя: идущий бой, если есть, и колода, с которой участник выйдет. */
export async function getBattleHome(userId: string, drinks?: GachaDrink[], now = Date.now()): Promise<BattleHome> {
  const pool = getPool();
  const cards = await battleCatalog(drinks, now);
  const [deck, rings, paid, row, blocked] = await Promise.all([
    ownedDeck(pool, userId, cards), ringsOf(pool, userId), paidToday(pool, userId),
    pool.query<{ id: string; state: BattleState }>(`select id, state from "battle" where "userId" = $1 and status = 'active'`, [userId]),
    pool.query('select 1 from "userBlock" where "userId" = $1', [userId]),
  ]);
  const active = row.rows[0];
  return {
    battle: active ? { id: active.id, view: battleView(active.state) } : null,
    deck: [...deck].sort((a, b) => cardValue(b) - cardValue(a)), own: deck.filter(card => card.cover).length,
    rings, paidLeft: Math.max(0, PAID_WINS_PER_DAY - paid), blocked: Boolean(blocked.rowCount),
  };
}

/** Новый бой. Идущий бой один: повторное нажатие из другой вкладки открывает его же. */
export async function startBattle(userId: string, drinks?: GachaDrink[], now = Date.now()): Promise<BattleOpen> {
  const cards = await battleCatalog(drinks, now);
  const client = await getPool().connect();
  try {
    await client.query('begin');
    await client.query('select 1 from "user" where id = $1 for no key update', [userId]);
    if ((await client.query('select 1 from "userBlock" where "userId" = $1', [userId])).rowCount) throw new BattleError('Аккаунт заблокирован.');
    const running = (await client.query<{ id: string; state: BattleState }>(`select id, state from "battle" where "userId" = $1 and status = 'active'`, [userId])).rows[0];
    if (running) { await client.query('commit'); return { id: running.id, view: battleView(running.state) }; }
    const deck = await ownedDeck(client, userId, cards);
    if (deck.length !== DECK_SIZE) throw new BattleError('Колода не собрана. Попробуйте позже.');
    const state = createBattle(randomInt(2 ** 31), deck, rivalDeck(deck, cards));
    // The rival may open the game: its first turn plays out before the page shows the board.
    while (state.active === 'rival' && !state.winner) applyAction(state, 'rival', botAction(state));
    const id = (await client.query<{ id: string }>(`insert into "battle"("userId", state) values ($1, $2) returning id`, [userId, JSON.stringify(state)])).rows[0]!.id;
    await client.query('commit');
    return { id, view: battleView(state) };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

/** Ход участника, а после «Конец хода» — весь ход бота кадрами, чтобы клиент показал его по шагам. Конец боя платит колечки. */
export async function moveBattle(userId: string, battleId: string, action: BattleAction | { kind: 'surrender' }): Promise<BattleMove> {
  const client = await getPool().connect();
  try {
    await client.query('begin');
    await client.query('select 1 from "user" where id = $1 for no key update', [userId]);
    const row = (await client.query<{ state: BattleState }>(`select state from "battle" where id = $1 and "userId" = $2 and status = 'active' for update`, [battleId, userId])).rows[0];
    if (!row) throw new BattleError('Этот бой уже закончился.');
    const state = row.state;
    const frames: BattleFrame[] = [];
    if (action.kind === 'surrender') {
      state.winner = 'rival';
      frames.push({ event: { kind: 'surrender' }, view: battleView(state) });
    } else {
      frames.push({ event: applyAction(state, 'me', action), view: battleView(state) });
      for (let step = 0; step < 80 && state.active === 'rival' && !state.winner; step++) {
        frames.push({ event: applyAction(state, 'rival', botAction(state)), view: battleView(state) });
      }
    }
    let reward: BattleReward | null = null;
    if (state.winner) {
      const paid = await paidToday(client, userId);
      const won = state.winner === 'me';
      const earned = won && paid < PAID_WINS_PER_DAY ? WIN_RINGS : 0;
      if (earned) await client.query(`insert into "ringLedger"("userId", reason, "sourceKey", amount) values ($1, 'battle', $2, $3)`, [userId, battleId, earned]);
      reward = { won, earned, rings: await ringsOf(client, userId), paidLeft: Math.max(0, PAID_WINS_PER_DAY - paid - (earned ? 1 : 0)) };
    }
    await client.query(`update "battle" set state = $2, status = $3, "finishedAt" = case when $3 = 'active' then null else now() end where id = $1`,
      [battleId, JSON.stringify(state), state.winner ? battleOutcome(state.winner) : 'active']);
    await client.query('commit');
    return { frames, reward };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

/** Собрать подарочную крутку из колечек: списание и начисление в одной транзакции под блокировкой участника. */
export async function craftSpin(userId: string, now = Date.now()): Promise<GachaState> {
  const client = await getPool().connect();
  try {
    await client.query('begin');
    await client.query('select 1 from "user" where id = $1 for no key update', [userId]);
    if ((await client.query('select 1 from "userBlock" where "userId" = $1', [userId])).rowCount) throw new BattleError('Аккаунт заблокирован.');
    if (await ringsOf(client, userId) < SPIN_RING_COST) throw new BattleError(`Нужно ${SPIN_RING_COST} колечек.`);
    const source = randomUUID();
    await client.query(`insert into "ringLedger"("userId", reason, "sourceKey", amount) values ($1, 'craft', $2, $3)`, [userId, source, -SPIN_RING_COST]);
    await client.query(`insert into "spinLedger"("userId", reason, "sourceKey", amount) values ($1, 'craft', $2, 1)`, [userId, source]);
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
  return getGachaState(userId, now);
}
