import type { PoolClient } from 'pg';
import { getPool } from '@/db/pool';
import { BROADCAST_AUDIENCES, BROADCAST_PAUSE_MINUTES, type BroadcastAudience, type BroadcastInput } from './push-broadcast-fields';

export interface BroadcastRow {
  id: string; title: string; body: string; path: string; audience: BroadcastAudience | 'self'; recipients: number; delivered: number;
  pending: number; adminEmail: string; createdAt: Date;
}
export type BroadcastReach = Record<BroadcastAudience, number>;

/** Who a mass broadcast reaches: the devices of members who did not turn announcements off and are not banned. */
const REACHABLE = `from "pushDevice" d join "user" u on u.id = d."userId"
  where u."pushAnnouncements" and not exists (select 1 from "userBlock" b where b."userId" = u.id)`;
const PROVIDERS: Record<BroadcastAudience, string> = { all: '', android: `and d.provider in ('fcm', 'rustore')`, ios: `and d.provider = 'apns'` };
/** One lock for every broadcast, so two admins cannot pass the pause together. */
const BROADCAST_LOCK = 7_154_001;

export async function getBroadcastReach(): Promise<BroadcastReach> {
  const { rows } = await getPool().query<BroadcastReach>(`select count(*)::int as all,
    (count(*) filter (where d.provider in ('fcm', 'rustore')))::int as android, (count(*) filter (where d.provider = 'apns'))::int as ios ${REACHABLE}`);
  return rows[0] ?? { all: 0, android: 0, ios: 0 };
}

export async function listBroadcasts(limit = 30): Promise<BroadcastRow[]> {
  const { rows } = await getPool().query<BroadcastRow>(`select b.id, b.title, b.body, b.path, b.audience, b.recipients, b.delivered, b."adminEmail", b."createdAt",
      (select count(*)::int from "pushOutbox" o where o.kind = 'broadcast' and o."sentAt" is null and o.payload->>'broadcastId' = b.id::text) as pending
    from "pushBroadcast" b order by b."createdAt" desc limit $1`, [limit]);
  return rows;
}

async function queue(client: PoolClient, input: BroadcastInput, audience: BroadcastAudience | 'self', adminEmail: string, tokens: string, params: string[] = []): Promise<number> {
  const { rows: [broadcast] } = await client.query<{ id: string }>(`insert into "pushBroadcast" (title, body, path, audience, "adminEmail") values ($1, $2, $3, $4, $5) returning id`,
    [input.title, input.body, input.path, audience, adminEmail]);
  const id = broadcast!.id;
  const payload = JSON.stringify({ broadcastId: id, title: input.title, body: input.body, path: input.path });
  const { rowCount } = await client.query(`insert into "pushOutbox" (token, kind, payload, "dedupeKey")
    select d.token, 'broadcast', $1::jsonb, 'broadcast:' || $2::text || ':' || d.token ${tokens}`, [payload, id, ...params]);
  await client.query('update "pushBroadcast" set recipients = $2 where id = $1', [id, rowCount ?? 0]);
  return rowCount ?? 0;
}

async function inTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
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

/** Queues the broadcast for every reachable device and returns how many; refuses an empty audience and a second one within the pause. */
export async function sendBroadcast(input: BroadcastInput, adminEmail: string): Promise<number> {
  if (!BROADCAST_AUDIENCES.includes(input.audience)) throw new Error('Выберите, кому отправить.');
  return inTransaction(async client => {
    await client.query('select pg_advisory_xact_lock($1)', [BROADCAST_LOCK]);
    const recent = await client.query(`select 1 from "pushBroadcast" where audience <> 'self' and "createdAt" > now() - make_interval(mins => $1) limit 1`, [BROADCAST_PAUSE_MINUTES]);
    if (recent.rowCount) throw new Error(`Между рассылками — не меньше ${BROADCAST_PAUSE_MINUTES} минут.`);
    const count = await queue(client, input, input.audience, adminEmail, `${REACHABLE} ${PROVIDERS[input.audience]}`);
    if (!count) throw new Error('Некому отправить: у этой аудитории нет устройств.');
    await client.query(`insert into "adminAuditLog" ("adminEmail", action, "targetType", "targetId") values ($1, 'push-broadcast', 'push', $2)`, [adminEmail, `${input.audience}:${count}`]);
    return count;
  });
}

/** A test on the admin's own devices, whatever the announcements switch says: it does not count against the pause. */
export async function sendTestBroadcast(input: BroadcastInput, admin: { userId: string; email: string }): Promise<number> {
  return inTransaction(async client => {
    const count = await queue(client, input, 'self', admin.email, `from "pushDevice" d where d."userId" = $3`, [admin.userId]);
    if (!count) throw new Error('На вашем аккаунте нет устройства с приложением: откройте приложение, войдите и разрешите уведомления.');
    return count;
  });
}
