import { randomBytes, randomInt } from 'node:crypto';
import type { PoolClient } from 'pg';
import { getPool } from '@/db/pool';
import { battleCatalog, BattleError, ownedDeck } from '@/lib/battle';
import { applyAction, battleEventFor, battleViewFor, BattleRuleError, createBattle, otherSide, type BattleAction, type BattleState, type BattleView, type Side } from '@/lib/battle-engine';
import {
  INVITE_HOURS, INVITES_PER_DUEL, LOG_SIZE, TURN_MS, entriesAfter, roleSide, settleClock, sideRole,
  type DuelEndReason, type DuelEvent, type DuelLogEntry, type DuelRole,
} from '@/lib/battle-duel-fields';
import { DECK_SIZE } from '@/lib/battle-fields';
import type { GachaDrink } from '@/lib/gacha';

interface DuelRow {
  id: string; code: string; hostId: string; guestId: string | null; status: 'open' | 'active' | 'finished' | 'cancelled';
  state: BattleState | null; seq: number; log: DuelLogEntry[]; turnEndsAt: Date | null; hostMissed: number; guestMissed: number;
  winner: DuelRole | null; reason: DuelEndReason | null; expiresAt: Date;
}

export interface DuelPlayer { id: string; name: string; username: string | null; avatarId: string | null }
/** Ход боя глазами того, кто его получает: события после его последнего номера и стол целиком. */
export interface DuelSync {
  id: string; seq: number; view: BattleView; frames: { seq: number; event: DuelEvent }[];
  /** Срок текущего хода и время сервера: клиент считает остаток со своей поправкой. */
  turnEndsAt: string | null; now: string;
  result: { won: boolean; reason: DuelEndReason } | null;
  /** Ход не прошёл (например, срок хода уже вышел): стол всё равно свежий. */
  error?: string;
}
export interface DuelPage {
  id: string; code: string; status: DuelRow['status'] | 'expired'; role: DuelRole | null;
  host: DuelPlayer; guest: DuelPlayer | null;
  /** Только участнику идущего или законченного боя. */
  sync: DuelSync | null;
}

const COLUMNS = 'id, code, "hostId", "guestId", status, state, seq, log, "turnEndsAt", "hostMissed", "guestMissed", winner, reason, "expiresAt"';
const PLAYER = (column: string) => `(select json_build_object('id', u.id, 'name', u.name, 'username', u.username,
  'avatarId', (select p.id::text from "profileImage" p where p."userId" = u.id and p.kind = 'avatar')) from "user" u where u.id = ${column})`;

const isBlocked = async (db: PoolClient, userId: string) => Boolean((await db.query('select 1 from "userBlock" where "userId" = $1', [userId])).rowCount);
const roleOf = (row: Pick<DuelRow, 'hostId' | 'guestId'>, userId: string): DuelRole | null => (row.hostId === userId ? 'host' : row.guestId === userId ? 'guest' : null);

async function transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('begin');
    const result = await work(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

/** Идущая дуэль участника (хозяином или гостем), если есть: она одна. */
async function activeDuel(db: PoolClient, userId: string) {
  return (await db.query<{ code: string }>(`select code from "battleDuel" where status = 'active' and ("hostId" = $1 or "guestId" = $1) limit 1`, [userId])).rows[0] ?? null;
}

/** Новый вызов или тот, что уже есть: открытый вызов у участника один, а идущий бой важнее нового. */
export async function createDuel(userId: string, now = Date.now()): Promise<{ code: string }> {
  return transaction(async client => {
    await client.query('select 1 from "user" where id = $1 for no key update', [userId]);
    if (await isBlocked(client, userId)) throw new BattleError('Аккаунт заблокирован.');
    await expireOpen(client, userId, now);
    const running = await activeDuel(client, userId);
    if (running) return running;
    const open = (await client.query<{ code: string }>(`select code from "battleDuel" where "hostId" = $1 and status = 'open'`, [userId])).rows[0];
    if (open) return open;
    const code = randomBytes(9).toString('base64url');
    await client.query(`insert into "battleDuel"(code, "hostId", "expiresAt") values ($1, $2, $3)`, [code, userId, new Date(now + INVITE_HOURS * 3600_000)]);
    return { code };
  });
}

/** Вызовы, которые никто не принял за сутки, закрываются, чтобы ссылка не жила вечно. */
async function expireOpen(db: PoolClient, userId: string, now: number) {
  await db.query(`update "battleDuel" set status = 'cancelled' where "hostId" = $1 and status = 'open' and "expiresAt" <= $2`, [userId, new Date(now)]);
}

/** Отменить свой вызов, пока его не приняли. */
export async function cancelDuel(userId: string, code: string): Promise<void> {
  await getPool().query(`update "battleDuel" set status = 'cancelled' where code = $1 and "hostId" = $2 and status = 'open'`, [code, userId]);
}

/** Принять вызов: колоды обоих собираются из их карточек, бой начинается сразу, первый ход — по жребию движка. */
export async function joinDuel(userId: string, code: string, drinks?: GachaDrink[], now = Date.now()): Promise<void> {
  const cards = await battleCatalog(drinks, now);
  await transaction(async client => {
    const row = (await client.query<DuelRow>(`select ${COLUMNS} from "battleDuel" where code = $1 for update`, [code])).rows[0];
    if (!row) throw new BattleError('Такого вызова нет.');
    if (row.guestId === userId && row.status !== 'open') return;
    if (row.status !== 'open' || row.expiresAt.getTime() <= now) throw new BattleError('Вызов уже не действует.');
    if (row.hostId === userId) throw new BattleError('Это ваш вызов — отправьте ссылку другу.');
    // Players lock in id order, so two people accepting each other's challenges cannot deadlock.
    for (const id of [row.hostId, userId].sort()) await client.query('select 1 from "user" where id = $1 for no key update', [id]);
    if (await isBlocked(client, userId)) throw new BattleError('Аккаунт заблокирован.');
    if (await isBlocked(client, row.hostId)) throw new BattleError('Вызов уже не действует.');
    const blocked = await client.query(`select 1 from "memberBlock" where ("blockerId" = $1 and "blockedId" = $2) or ("blockerId" = $2 and "blockedId" = $1)`, [row.hostId, userId]);
    if (blocked.rowCount) throw new BattleError('Сыграть с этим участником нельзя.');
    if (await activeDuel(client, userId)) throw new BattleError('Сначала доиграйте свой бой с другом.');
    if (await activeDuel(client, row.hostId)) throw new BattleError('Соперник уже в другом бою. Попробуйте позже.');
    const [hostDeck, guestDeck] = await Promise.all([ownedDeck(client, row.hostId, cards), ownedDeck(client, userId, cards)]);
    if (hostDeck.length !== DECK_SIZE || guestDeck.length !== DECK_SIZE) throw new BattleError('Колода не собрана. Попробуйте позже.');
    const state = createBattle(randomInt(2 ** 31), hostDeck, guestDeck);
    await client.query(`update "battleDuel" set "guestId" = $2, status = 'active', state = $3, "startedAt" = $4, "turnEndsAt" = $5 where id = $1`,
      [row.id, userId, JSON.stringify(state), new Date(now), new Date(now + TURN_MS)]);
  });
}

/** Записывает события в журнал и считает, кто и как выиграл. */
function record(row: DuelRow, events: readonly DuelEvent[]) {
  for (const event of events) row.log.push({ seq: ++row.seq, event });
  if (row.log.length > LOG_SIZE) row.log = row.log.slice(-LOG_SIZE);
}

function finish(row: DuelRow, reason: DuelEndReason) {
  row.status = 'finished';
  row.winner = sideRole(row.state!.winner!);
  row.reason = reason;
}

/** Догоняет часы хода под блокировкой строки: пропуски и поражение по времени. */
function settle(row: DuelRow, now: number) {
  if (row.status !== 'active' || !row.state || !row.turnEndsAt) return;
  const clock = { turnEndsAt: row.turnEndsAt.getTime(), missed: { me: row.hostMissed, rival: row.guestMissed } };
  const { events, timedOut } = settleClock(row.state, clock, now);
  if (!events.length) return;
  record(row, events);
  row.turnEndsAt = new Date(clock.turnEndsAt);
  row.hostMissed = clock.missed.me;
  row.guestMissed = clock.missed.rival;
  // A turn the clock ended can still finish the fight: drawing from an empty deck hurts.
  if (timedOut) finish(row, 'timeout');
  else if (row.state.winner) finish(row, 'hero');
}

async function save(db: PoolClient, row: DuelRow) {
  await db.query(`update "battleDuel" set status = $2, state = $3, seq = $4, log = $5, "turnEndsAt" = $6, "hostMissed" = $7, "guestMissed" = $8,
      winner = $9, reason = $10, "finishedAt" = case when $2 = 'finished' then coalesce("finishedAt", now()) else null end where id = $1`,
    [row.id, row.status, JSON.stringify(row.state), row.seq, JSON.stringify(row.log), row.turnEndsAt, row.hostMissed, row.guestMissed, row.winner, row.reason]);
}

function syncFor(row: DuelRow, role: DuelRole, after: number, now: number): DuelSync {
  const side = roleSide(role);
  const entries = entriesAfter(row.log, after) ?? [];
  return {
    id: row.id, seq: row.seq, view: battleViewFor(row.state!, side),
    frames: entries.map(({ seq, event }) => ({ seq, event: flipEvent(event, side) })),
    turnEndsAt: row.status === 'active' && row.turnEndsAt ? row.turnEndsAt.toISOString() : null, now: new Date(now).toISOString(),
    result: row.status === 'finished' && row.winner ? { won: row.winner === role, reason: row.reason ?? 'hero' } : null,
  };
}

function flipEvent(event: DuelEvent, side: Side): DuelEvent {
  if (event.kind === 'surrender' || event.kind === 'timeout') return side === 'me' ? event : { ...event, side: otherSide(event.side) };
  return battleEventFor(event, side);
}

/**
 * Ход участника дуэли (или сдача). Чей сейчас ход, проверяет движок; сначала догоняются часы. Незаконный ход не
 * откатывает догнанные часы: стол сохраняется и уходит вместе с текстом ошибки.
 */
export async function moveDuel(userId: string, duelId: string, action: BattleAction | { kind: 'surrender' }, after: number, now = Date.now()): Promise<DuelSync> {
  return transaction(async client => {
    const row = (await client.query<DuelRow>(`select ${COLUMNS} from "battleDuel" where id = $1 for update`, [duelId])).rows[0];
    const role = row && roleOf(row, userId);
    if (!row || !role || !row.state) throw new BattleError('Такого боя нет.');
    settle(row, now);
    let error: string | undefined;
    if (row.status !== 'active') error = 'Бой уже закончился.';
    else try {
      const side = roleSide(role);
      if (action.kind === 'surrender') {
        row.state.winner = otherSide(side);
        record(row, [{ kind: 'surrender', side }]);
        finish(row, 'surrender');
      } else {
        const event = applyAction(row.state, side, action);
        record(row, [event]);
        // A move of one's own clears the missed turns; ending the turn starts the other player's clock.
        if (side === 'me') row.hostMissed = 0; else row.guestMissed = 0;
        if (event.kind === 'turn') row.turnEndsAt = new Date(now + TURN_MS);
        if (row.state.winner) finish(row, 'hero');
      }
    } catch (failure) {
      if (!(failure instanceof BattleRuleError)) throw failure;
      error = failure.message;
    }
    await save(client, row);
    return { ...syncFor(row, role, after, now), ...(error ? { error } : {}) };
  });
}

/** Опрос стола, пока ходит соперник. Запись нужна, только когда срок хода прошёл. */
export async function pollDuel(userId: string, duelId: string, after: number, now = Date.now()): Promise<DuelSync> {
  const row = (await getPool().query<DuelRow>(`select ${COLUMNS} from "battleDuel" where id = $1`, [duelId])).rows[0];
  const role = row && roleOf(row, userId);
  if (!row || !role || !row.state) throw new BattleError('Такого боя нет.');
  if (row.status !== 'active' || !row.turnEndsAt || row.turnEndsAt.getTime() > now) return syncFor(row, role, after, now);
  return transaction(async client => {
    const locked = (await client.query<DuelRow>(`select ${COLUMNS} from "battleDuel" where id = $1 for update`, [duelId])).rows[0]!;
    settle(locked, now);
    await save(client, locked);
    return syncFor(locked, role, after, now);
  });
}

/** Страница вызова: кто зовёт, кто принял и — участнику — стол. */
export async function getDuelPage(code: string, viewerId: string | null, now = Date.now()): Promise<DuelPage | null> {
  const found = (await getPool().query<DuelRow & { host: DuelPlayer; guest: DuelPlayer | null }>(
    `select ${COLUMNS}, ${PLAYER('d."hostId"')} as host, ${PLAYER('d."guestId"')} as guest from "battleDuel" d where code = $1`, [code])).rows[0];
  if (!found) return null;
  let row: DuelRow = found;
  const role = viewerId ? roleOf(row, viewerId) : null;
  // Opening the page also catches the clock up, so a player who left sees how the fight ended.
  if (role && row.status === 'active' && row.turnEndsAt && row.turnEndsAt.getTime() <= now) {
    row = await transaction(async client => {
      const locked = (await client.query<DuelRow>(`select ${COLUMNS} from "battleDuel" where id = $1 for update`, [row.id])).rows[0]!;
      settle(locked, now);
      await save(client, locked);
      return locked;
    });
  }
  const status = row.status === 'open' && row.expiresAt.getTime() <= now ? 'expired' : row.status;
  return {
    id: row.id, code: row.code, status, role, host: found.host, guest: found.guest,
    sync: role && row.state && (row.status === 'active' || row.status === 'finished') ? syncFor(row, role, row.seq, now) : null,
  };
}

/** Состояние вызова для комнаты ожидания: принял ли кто-нибудь. */
export async function duelStatus(code: string): Promise<DuelRow['status'] | null> {
  return (await getPool().query<{ status: DuelRow['status'] }>('select status from "battleDuel" where code = $1', [code])).rows[0]?.status ?? null;
}

/** Друзья (взаимная подписка), которых можно позвать с сайта: недавно заходившие первыми. */
export async function duelFriends(userId: string): Promise<(DuelPlayer & { invited: boolean })[]> {
  const { rows } = await getPool().query<DuelPlayer & { invited: boolean }>(`
    select u.id, u.name, u.username, (select p.id::text from "profileImage" p where p."userId" = u.id and p.kind = 'avatar') as "avatarId",
      exists(select 1 from notification n join "battleDuel" d on n."eventKey" = 'duel-invite:' || d.id || ':' || u.id
        where n."userId" = u.id and d."hostId" = $1 and d.status = 'open') as invited
    from "userFollow" f
    join "userFollow" b on b."userId" = f."targetId" and b."targetId" = f."userId"
    join "user" u on u.id = f."targetId"
    where f."userId" = $1 and u.username is not null
      and not exists(select 1 from "userBlock" x where x."userId" = u.id)
      and not exists(select 1 from "memberBlock" m where (m."blockerId" = $1 and m."blockedId" = u.id) or (m."blockerId" = u.id and m."blockedId" = $1))
    order by u."lastSeenAt" desc nulls last limit 50`, [userId]);
  return rows;
}

/**
 * Позвать с сайта: только друга (взаимная подписка) или того, с кем уже был бой, — иначе это стало бы спамом
 * незнакомым людям. Одно уведомление на друга в одном вызове, не больше `INVITES_PER_DUEL`.
 */
export async function inviteToDuel(userId: string, code: string, friendId: string): Promise<void> {
  await transaction(async client => {
    const duel = (await client.query<{ id: string }>(`select id from "battleDuel" where code = $1 and "hostId" = $2 and status = 'open' and "expiresAt" > now() for update`, [code, userId])).rows[0];
    if (!duel) throw new BattleError('Вызов уже не действует.');
    if (friendId === userId) throw new BattleError('Позовите кого-нибудь другого.');
    const allowed = await client.query(`select 1 from "user" u where u.id = $2
      and not exists(select 1 from "userBlock" x where x."userId" = u.id)
      and not exists(select 1 from "memberBlock" m where (m."blockerId" = $1 and m."blockedId" = u.id) or (m."blockerId" = u.id and m."blockedId" = $1))
      and (exists(select 1 from "userFollow" f join "userFollow" b on b."userId" = f."targetId" and b."targetId" = f."userId" where f."userId" = $1 and f."targetId" = u.id)
        or exists(select 1 from "battleDuel" d where d.status = 'finished' and ((d."hostId" = $1 and d."guestId" = u.id) or (d."hostId" = u.id and d."guestId" = $1))))`, [userId, friendId]);
    if (!allowed.rowCount) throw new BattleError('Позвать с сайта можно только друга.');
    const sent = (await client.query<{ n: number }>(`select count(*)::int n from notification where "eventKey" like $1`, [`duel-invite:${duel.id}:%`])).rows[0]!.n;
    if (sent >= INVITES_PER_DUEL) throw new BattleError(`В один вызов можно позвать не больше ${INVITES_PER_DUEL} друзей.`);
    await client.query(`insert into notification("userId", "actorId", kind, "eventKey", payload) values ($1, $2, 'duel-invite', $3, $4) on conflict ("userId", "eventKey") do nothing`,
      [friendId, userId, `duel-invite:${duel.id}:${friendId}`, JSON.stringify({ code })]);
  });
}

/** Реванш: новый вызов и приглашение тому же сопернику. */
export async function rematchDuel(userId: string, duelId: string, now = Date.now()): Promise<{ code: string }> {
  const row = (await getPool().query<{ hostId: string; guestId: string | null; status: string }>('select "hostId", "guestId", status from "battleDuel" where id = $1', [duelId])).rows[0];
  if (!row || row.status !== 'finished' || (row.hostId !== userId && row.guestId !== userId)) throw new BattleError('Такого боя нет.');
  const { code } = await createDuel(userId, now);
  const rival = row.hostId === userId ? row.guestId! : row.hostId;
  await inviteToDuel(userId, code, rival).catch(() => undefined);
  return { code };
}

/** Для экрана боя с Совой: идущий бой с другом или свой открытый вызов. */
export async function duelSummary(userId: string): Promise<{ code: string; status: 'open' | 'active'; rival: string | null } | null> {
  const { rows } = await getPool().query<{ code: string; status: 'open' | 'active'; rival: string | null }>(`
    select d.code, d.status, (select coalesce('@' || u.username, u.name) from "user" u where u.id = case when d."hostId" = $1 then d."guestId" else d."hostId" end) as rival
    from "battleDuel" d where (d."hostId" = $1 or d."guestId" = $1) and (d.status = 'active' or (d.status = 'open' and d."expiresAt" > now()))
    order by d.status = 'active' desc, d."createdAt" desc limit 1`, [userId]);
  return rows[0] ?? null;
}
