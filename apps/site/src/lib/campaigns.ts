import { randomUUID, createHmac, timingSafeEqual } from 'node:crypto';
import type { Pool } from 'pg';
import { getPool } from '@/db/pool';
import { getAuthEnv } from '@/lib/env';
import { CAMPAIGN_COOKIE, type CampaignInput } from './campaign-fields';
export function visitorCookie(visitor: string): string {
  return `${visitor}.${createHmac('sha256', getAuthEnv().authSecret).update(`campaign:${visitor}`).digest('hex')}`;
}
export function readVisitor(value?: string): string | null {
  if (!value || !/^[0-9a-f-]{36}\.[0-9a-f]{64}$/.test(value)) return null;
  const visitor = value.slice(0, 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(visitor)) return null;
  return timingSafeEqual(Buffer.from(value), Buffer.from(visitorCookie(visitor))) ? visitor : null;
}
export async function createCampaign(input: CampaignInput) {
  const id = randomUUID();
  await getPool().query('insert into "adCampaign"(id,name,path,source,medium,campaign,content,term) values($1,$2,$3,$4,$5,$6,$7,$8)', [id,input.name,input.path,input.source,input.medium,input.campaign,input.content,input.term]);
  return id;
}
export async function recordCampaignVisit(campaign: string, visitor: string) {
  // One visit per browser/campaign in a fixed 30-minute window, including concurrent requests.
  const result = await getPool().query(`insert into "adVisit"(id,"campaignId",visitor,bucket)
    select $1,id,$3,floor(extract(epoch from now())/1800)::bigint from "adCampaign" where id=$2
    on conflict ("campaignId",visitor,bucket) do nothing returning id`, [randomUUID(),campaign,visitor]);
  return Boolean(result.rowCount);
}
export async function attributeRegistration(userId: string, createdAt: Date, cookieHeader: string | null, db: Pool = getPool()) {
  const raw = cookieHeader?.split(';').map(part => part.trim()).find(part => part.startsWith(`${CAMPAIGN_COOKIE}=`))?.slice(CAMPAIGN_COOKIE.length+1);
  const visitor = readVisitor(raw);
  if (!visitor) return;
  await db.query(`insert into "adRegistration"("userId","visitId","createdAt")
    select $1,id,$3 from "adVisit" where visitor=$2 and "createdAt" <= $3 and "createdAt">=$3::timestamptz-interval '30 days'
    order by "createdAt",id limit 1 on conflict ("userId") do nothing`, [userId,visitor,createdAt]);
}
export interface CampaignStats extends CampaignInput { id: string; visits: number; visitors: number; registrations: number; converted: number; reviewers: number; publishers: number }
export async function campaignStats(days: number, page = 1) {
  const db=getPool();
  const count=(await db.query<{count:number}>('select count(*)::int as count from "adCampaign"')).rows[0]?.count ?? 0;
  const current=Math.min(Math.max(1,page),Math.max(1,Math.ceil(count/25)));
  const {rows}=await db.query<CampaignStats>(`with selected as (select * from "adCampaign" order by "createdAt" desc,id limit 25 offset $2),
    visits as (select v.* from "adVisit" v join selected c on c.id=v."campaignId" where ($1::int=0 or v."createdAt">=now()-make_interval(days=>$1))),
    counts as (select "campaignId",count(*)::int visits,count(distinct visitor)::int visitors from visits group by 1),
    conversions as (select v."campaignId",count(*)::int registrations,count(distinct v.visitor)::int converted,
      count(*) filter(where exists(select 1 from review r where r."userId"=a."userId"))::int reviewers,
      count(*) filter(where exists(select 1 from "tierList" t where t."userId"=a."userId" and t.status='published'))::int publishers
      from visits v join "adRegistration" a on a."visitId"=v.id group by 1)
    select s.*,coalesce(c.visits,0) visits,coalesce(c.visitors,0) visitors,coalesce(a.registrations,0) registrations,
      coalesce(a.converted,0) converted,coalesce(a.reviewers,0) reviewers,coalesce(a.publishers,0) publishers
      from selected s left join counts c on c."campaignId"=s.id left join conversions a on a."campaignId"=s.id order by s."createdAt" desc,s.id`,[days,(current-1)*25]);
  return {items:rows,total:count,page:current};
}
