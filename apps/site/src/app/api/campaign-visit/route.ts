import { randomUUID, createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthEnv } from '@/lib/env';
import { CAMPAIGN_COOKIE } from '@/lib/campaign-fields';
import { readVisitor, visitorCookie, recordCampaignVisit } from '@/lib/campaigns';
// Bounded per-process burst protection; keys are ephemeral hashes, never persisted.
const state=globalThis as typeof globalThis & {campaignBursts?: Map<string,{count:number;until:number}>};
function allowRequest(request: NextRequest) {
  const now=Date.now(); const buckets=state.campaignBursts ??=new Map();
  const key=createHash('sha256').update(request.headers.get('x-real-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown').digest('hex');
  for (const [id,bucket] of buckets) if(bucket.until<=now) buckets.delete(id);
  const bucket=buckets.get(key);
  if(bucket) { if(bucket.count>=60) return false; bucket.count++; return true; }
  if(buckets.size>=10000) return false;
  buckets.set(key,{count:1,until:now+60000}); return true;
}
export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== new URL(getAuthEnv().authUrl).origin || request.headers.get('sec-fetch-site') === 'cross-site') return new Response(null,{status:403});
  if (/bot|crawler|spider|preview/i.test(request.headers.get('user-agent') ?? '')) return new Response(null,{status:204});
  if (!allowRequest(request)) return new Response(null,{status:429,headers:{'Retry-After':'60'}});
  const id=request.nextUrl.searchParams.get('id');
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) return new Response(null,{status:400});
  const visitor=readVisitor(request.cookies.get(CAMPAIGN_COOKIE)?.value) ?? randomUUID();
  try {
    await recordCampaignVisit(id,visitor);
    const response=new NextResponse(null,{status:204,headers:{'Cache-Control':'no-store'}});
    response.cookies.set(CAMPAIGN_COOKIE,visitorCookie(visitor),{httpOnly:true,sameSite:'lax',secure:new URL(getAuthEnv().authUrl).protocol==='https:',path:'/',maxAge:30*86400});
    return response;
  } catch { return new Response(null,{status:503}); }
}
