import { getPool } from '@/db/pool';
import { getCabinet, logBusiness } from '@/lib/business';
import { BusinessError } from '@/lib/business-fields';
import { PLANS, planPrice, type BusinessPlan, type PlanRequestInput, type PromoRequestInput } from '@/lib/business-plans';

export type PlanRequestStatus = 'pending' | 'invoiced' | 'paid' | 'cancelled';
export interface PlanRequest {
  id: string; businessId: string; business: string; plan: 'brand' | 'network'; period: 'month' | 'year'; payer: string; inn: string; email: string;
  comment: string | null; status: PlanRequestStatus; adminNote: string | null; createdAt: Date; amount: number; founder: boolean;
}
export type PromoStatus = 'new' | 'contacted' | 'running' | 'done' | 'declined';
export interface PromoRequest { id: string; businessId: string; business: string; placement: string; budget: number; comment: string | null; status: PromoStatus; erid: string | null; createdAt: Date }

const REQUEST_COLUMNS = `r.id, r."businessId", b.name as business, r.plan, r.period, r.payer, r.inn, r.email, r.comment, r.status, r."adminNote", r."createdAt", b.founder`;
const withAmount = (row: Omit<PlanRequest, 'amount'>): PlanRequest => ({ ...row, amount: planPrice(row.plan, row.period, row.founder) });

/** The owner asks for a plan to be invoiced; one open request at a time. */
export async function requestPlan(userId: string, input: PlanRequestInput): Promise<void> {
  const cabinet = await getCabinet(userId);
  if (!cabinet || cabinet.role !== 'owner') throw new BusinessError('Тариф подключает владелец кабинета.');
  if (cabinet.business.status !== 'approved') throw new BusinessError('Тариф можно подключить после проверки компании.');
  await getPool().query(`insert into "businessPlanRequest"("businessId", "userId", plan, period, payer, inn, email, comment) values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [cabinet.business.id, userId, input.plan, input.period, input.payer, input.inn, input.email, input.comment])
    .catch((error: { code?: string }) => { if (error.code === '23505') throw new BusinessError('Заявка на счёт уже есть — дождитесь его или отмените заявку.'); throw error; });
  await logBusiness(cabinet.business.id, userId, 'plan-request', `${PLANS[input.plan].title}, ${input.period === 'year' ? 'год' : 'месяц'}`);
}

export async function cancelPlanRequest(userId: string, id: string): Promise<void> {
  const cabinet = await getCabinet(userId);
  if (!cabinet || cabinet.role !== 'owner') throw new BusinessError('Заявку отменяет владелец кабинета.');
  await getPool().query(`update "businessPlanRequest" set status = 'cancelled', "updatedAt" = now() where id = $1 and "businessId" = $2 and status in ('pending', 'invoiced')`, [id, cabinet.business.id]);
}

export async function listPlanRequests(businessId: string): Promise<PlanRequest[]> {
  return (await getPool().query<Omit<PlanRequest, 'amount'>>(`select ${REQUEST_COLUMNS} from "businessPlanRequest" r join business b on b.id = r."businessId"
    where r."businessId" = $1 order by r."createdAt" desc limit 20`, [businessId])).rows.map(withAmount);
}

export async function listPlanRequestsForAdmin(open = true): Promise<PlanRequest[]> {
  return (await getPool().query<Omit<PlanRequest, 'amount'>>(`select ${REQUEST_COLUMNS} from "businessPlanRequest" r join business b on b.id = r."businessId"
    where ($1::boolean and r.status in ('pending', 'invoiced')) or (not $1::boolean and r.status in ('paid', 'cancelled')) order by r."createdAt" ${open ? 'asc' : 'desc'} limit 100`, [open])).rows.map(withAmount);
}

/**
 * The team moves an invoice on: sent, paid or cancelled. «Оплачен» extends the plan from its current end (or today)
 * by the period and records it in the admin log — in one transaction.
 */
export async function setPlanRequestStatus(adminId: string, id: string, status: Exclude<PlanRequestStatus, 'pending'>, note: string): Promise<void> {
  const db = await getPool().connect();
  try {
    await db.query('begin');
    const staff = (await db.query<{ email: string; role: string }>(`select a.email, a.role from "user" u join "siteAdmin" a on a.email = lower(u.email) where u.id = $1`, [adminId])).rows[0];
    if (!staff || staff.role !== 'admin') throw new BusinessError('Оплаты отмечает администратор.');
    const request = (await db.query<{ businessId: string; plan: BusinessPlan; period: 'month' | 'year' }>(
      `update "businessPlanRequest" set status = $2, "adminNote" = nullif($3, ''), "updatedAt" = now() where id = $1 and status in ('pending', 'invoiced')
       returning "businessId", plan, period`, [id, status, note.trim().slice(0, 500)])).rows[0];
    if (!request) throw new BusinessError('Заявка уже закрыта.');
    if (status === 'paid') await db.query(
      `update business set plan = $2, "planUntil" = greatest(coalesce(case when plan = $2 then "planUntil" end, now()), now()) + case when $3 = 'year' then interval '1 year' else interval '1 month' end
       where id = $1`, [request.businessId, request.plan, request.period]);
    await db.query('insert into "adminAuditLog" ("adminEmail", action, "targetType", "targetId") values ($1, $2, $3, $4)', [staff.email, `plan-${status}`, 'business-plan', id]);
    await db.query('commit');
  } catch (error) { await db.query('rollback'); throw error; } finally { db.release(); }
}

/** A promotion request (owner or manager); the team agrees it and registers each placement with the ОРД. */
export async function requestPromo(userId: string, input: PromoRequestInput): Promise<void> {
  const cabinet = await getCabinet(userId);
  if (!cabinet || cabinet.business.status !== 'approved') throw new BusinessError('Продвижение доступно подтверждённой компании.');
  if (cabinet.role === 'analyst') throw new BusinessError('У роли «Аналитик» только просмотр.');
  const recent = await getPool().query(`select 1 from "businessPromoRequest" where "businessId" = $1 and "createdAt" > now() - interval '1 hour'`, [cabinet.business.id]);
  if (recent.rowCount) throw new BusinessError('Заявка уже отправлена — мы свяжемся с вами.');
  await getPool().query(`insert into "businessPromoRequest"("businessId", "userId", placement, budget, comment) values ($1, $2, $3, $4, $5)`,
    [cabinet.business.id, userId, input.placement, input.budget, input.comment]);
  await logBusiness(cabinet.business.id, userId, 'promo-request', `${input.placement}, ${input.budget.toLocaleString('ru-RU')} ₽`);
}

export async function listPromoRequests(businessId: string | null): Promise<PromoRequest[]> {
  return (await getPool().query<PromoRequest>(`select p.id, p."businessId", b.name as business, p.placement, p.budget, p.comment, p.status, p.erid, p."createdAt"
    from "businessPromoRequest" p join business b on b.id = p."businessId" where ($1::uuid is null or p."businessId" = $1) order by p."createdAt" desc limit 100`, [businessId])).rows;
}

/** The team's progress on a promotion: status and the ОРД token (erid) once registered. */
export async function setPromoStatus(adminId: string, id: string, status: PromoStatus, erid: string): Promise<void> {
  const db = await getPool().connect();
  try {
    await db.query('begin');
    const staff = (await db.query<{ email: string; role: string }>(`select a.email, a.role from "user" u join "siteAdmin" a on a.email = lower(u.email) where u.id = $1`, [adminId])).rows[0];
    if (!staff || staff.role !== 'admin') throw new BusinessError('Продвижение ведёт администратор.');
    const token = erid.trim().slice(0, 100);
    if (status === 'running' && !token) throw new BusinessError('Перед запуском укажите erid — токен маркировки из ОРД.');
    const updated = await db.query(`update "businessPromoRequest" set status = $2, erid = coalesce(nullif($3, ''), erid), "updatedAt" = now() where id = $1`, [id, status, token]);
    if (!updated.rowCount) throw new BusinessError('Заявка не найдена.');
    await db.query('insert into "adminAuditLog" ("adminEmail", action, "targetType", "targetId") values ($1, $2, $3, $4)', [staff.email, `promo-${status}`, 'business-promo', id]);
    await db.query('commit');
  } catch (error) { await db.query('rollback'); throw error; } finally { db.release(); }
}

/** Usage against the plan's limits, for the «Тариф» section. */
export async function planUsage(businessId: string): Promise<{ members: number; competitors: number; brands: number }> {
  return (await getPool().query<{ members: number; competitors: number; brands: number }>(
    `select 1 + (select count(*) from "businessMember" where "businessId" = $1)::int + (select count(*) from "businessEmailInvite" where "businessId" = $1)::int as members,
       (select count(*) from "businessCompetitor" where "businessId" = $1)::int as competitors,
       (select count(distinct brand) from "businessDrink" where "businessId" = $1 and status <> 'rejected')::int as brands`, [businessId])).rows[0]!;
}
