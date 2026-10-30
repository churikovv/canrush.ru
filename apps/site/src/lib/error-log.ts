import type { Pool } from 'pg';
import { getPool } from '@/db/pool';
import { errorGroupHash, serverErrorReport, isIgnoredError, type ErrorReport, type ErrorSource } from '@/lib/error-log-fields';
import { enqueueTelegram, telegramAdminIds, type ErrorAlertPayload } from '@/lib/telegram-bot/outbox';

/**
 * Anyone can post to the browser's endpoint, so its groups are capped and so are the alerts of each source: a bot fills
 * neither the table nor the budget of server alerts. A broken deploy stays within a few messages too: a group past the
 * budget alerts on its next repeat.
 */
export const MAX_CLIENT_GROUPS = 500;
export const ALERTS_PER_HOUR = 10;
const RETENTION = `interval '30 days'`;
const ALERT_INTERVAL = `interval '1 hour'`;

export interface ErrorGroup {
  hash: string; source: ErrorSource; path: string; message: string; stack: string; count: number;
  firstSeenAt: Date; lastSeenAt: Date; hiddenAt: Date | null;
}

/** Hidden groups keep counting; an alert is sent only for a visible group that has been quiet in Telegram for an hour. */
export async function recordError(report: ErrorReport, pool: Pool = getPool()): Promise<void> {
  const hash = errorGroupHash(report);
  const { rows } = await pool.query<{ alert: boolean }>(`
    insert into "errorGroup" (hash, source, path, message, stack)
    select $1, $2, $3, $4, $5
    where $2::text = 'server' or exists (select 1 from "errorGroup" where hash = $1) or (select count(*) from "errorGroup" where source = 'client') < $6
    on conflict (hash) do update set count = "errorGroup".count + 1, "lastSeenAt" = now(), path = excluded.path, stack = excluded.stack
    returning "hiddenAt" is null and ("notifiedAt" is null or "notifiedAt" <= now() - ${ALERT_INTERVAL}) as alert`,
  [hash, report.source, report.path, report.message, report.stack, MAX_CLIENT_GROUPS]);
  if (rows[0]?.alert) await queueErrorAlert(hash, pool);
}

/** The claim and the messages commit together: the row lock lets one of several failing requests through. */
async function queueErrorAlert(hash: string, pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const { rows } = await client.query<ErrorAlertPayload & { hour: string }>(`
      update "errorGroup" g set "notifiedAt" = now()
      where g.hash = $1 and g."hiddenAt" is null and (g."notifiedAt" is null or g."notifiedAt" <= now() - ${ALERT_INTERVAL})
        and (select count(*) from "errorGroup" o where o.source = g.source and o."notifiedAt" > now() - ${ALERT_INTERVAL}) < $2
      returning g.source, g.path, g.message, g.count, to_char(now() at time zone 'UTC', 'YYYYMMDDHH24') as hour`, [hash, ALERTS_PER_HOUR]);
    const claimed = rows[0];
    if (claimed) {
      const { hour, ...payload } = claimed;
      for (const admin of await telegramAdminIds(client)) await enqueueTelegram(client, admin, 'error-alert', payload, `error:${hash}:${hour}:${admin}`);
    }
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

/** From `onRequestError`: a failure here must not hide the original error, which Next has already logged. */
export async function recordServerError(error: unknown, requestPath: string, route?: string): Promise<void> {
  if (isIgnoredError(error)) return;
  try {
    await recordError(serverErrorReport(error, requestPath, route));
  } catch (failure) {
    console.error('Error log failed', failure instanceof Error ? failure.message : failure);
  }
}

export interface ErrorGroupPage { items: ErrorGroup[]; hasMore: boolean; visible: number; hidden: number }

export async function listErrorGroups(hidden: boolean, page: number, perPage = 50): Promise<ErrorGroupPage> {
  const [groups, counts] = await Promise.all([
    getPool().query<ErrorGroup>(`
      select hash, source, path, message, stack, count, "firstSeenAt", "lastSeenAt", "hiddenAt" from "errorGroup"
      where ("hiddenAt" is not null) = $1 order by "lastSeenAt" desc, hash limit $2 offset $3`, [hidden, perPage + 1, (page - 1) * perPage]),
    getPool().query<{ visible: number; hidden: number }>(`
      select (count(*) filter (where "hiddenAt" is null))::int as visible, (count(*) filter (where "hiddenAt" is not null))::int as hidden from "errorGroup"`),
  ]);
  return { items: groups.rows.slice(0, perPage), hasMore: groups.rows.length > perPage, visible: counts.rows[0]?.visible ?? 0, hidden: counts.rows[0]?.hidden ?? 0 };
}

export async function setErrorHidden(adminEmail: string, hash: string, hidden: boolean): Promise<void> {
  await getPool().query(`
    with changed as (update "errorGroup" set "hiddenAt" = case when $3 then now() end where hash = $2 and ("hiddenAt" is not null) <> $3 returning hash)
    insert into "adminAuditLog" ("adminEmail", action, "targetType", "targetId")
    select $1, case when $3 then 'error-hide' else 'error-show' end, 'error', hash from changed`, [adminEmail, hash, hidden]);
}

/** A group that has been silent for 30 days goes; one that keeps failing stays, hidden or not. Runs in the morning cleanup. */
export async function pruneErrorGroups(pool: Pool): Promise<void> {
  await pool.query(`delete from "errorGroup" where "lastSeenAt" < now() - ${RETENTION}`);
}
