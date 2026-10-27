import { getPool } from '@/db/pool';
import { BusinessError } from '@/lib/business-fields';
import { flavorName } from '@/lib/catalog-query';
import type { GigaChatClient } from '@/lib/gigachat';
import { DIGEST_COOLDOWN_HOURS, DIGEST_MAX_REVIEWS, DIGEST_MIN_REVIEWS, digestPrompt, parseDigest, type ReviewDigest } from '@/lib/review-digest-fields';

/**
 * The review summary of one catalog drink — written by the model from review texts and scores, stored per drink in
 * `businessReviewDigest` (`businessId` — the company that asked, null for the nightly catalog run). The drink page and
 * the business cabinet show the same latest row.
 */
const NOT_BANNED = `not exists(select 1 from "userBlock" b where b."userId" = r."userId")`;

/**
 * Writes a new summary: at least DIGEST_MIN_REVIEWS reviews, something new since the last one, not within
 * DIGEST_COOLDOWN_HOURS of it. Only texts and scores of the latest DIGEST_MAX_REVIEWS reviews go out, never names.
 */
export async function writeReviewDigest(brand: string, flavor: string, client: GigaChatClient, businessId: string | null): Promise<ReviewDigest> {
  const db = getPool();
  const [{ rows: reviews }, last] = await Promise.all([
    db.query<{ taste: number; design: number; text: string; createdAt: Date }>(
      `select r.taste, r.design, r.text, r."createdAt" from review r where r.brand = $1 and r.flavor = $2 and ${NOT_BANNED}
       order by r."createdAt" desc limit $3`, [brand, flavor, DIGEST_MAX_REVIEWS]),
    // Timestamps stay in SQL: the database keeps microseconds, a JS Date only milliseconds.
    db.query<{ createdAt: Date; fresh: boolean }>(
      `select g."createdAt", exists(select 1 from review r where r.brand = $1 and r.flavor = $2 and r."createdAt" > g."lastReviewAt" and ${NOT_BANNED}) as fresh
       from "businessReviewDigest" g where g.brand = $1 and g.flavor = $2 order by g."createdAt" desc limit 1`, [brand, flavor]),
  ]);
  if (reviews.length < DIGEST_MIN_REVIEWS) throw new BusinessError(`Для разбора нужно хотя бы ${DIGEST_MIN_REVIEWS} отзыва.`);
  const previous = last.rows[0];
  if (previous && !previous.fresh) throw new BusinessError('Новых отзывов после прошлого разбора нет.');
  if (previous && Date.now() - previous.createdAt.getTime() < DIGEST_COOLDOWN_HOURS * 3_600_000) throw new BusinessError(`Разбор можно обновлять раз в ${DIGEST_COOLDOWN_HOURS} часов.`);
  let answer: string;
  try { answer = await client.chat(digestPrompt(`${brand} · ${flavorName(flavor)}`, reviews), { maxTokens: 900 }); }
  catch (error) { console.error('[review-digest] model failed', error instanceof Error ? error.message : 'unknown'); throw new BusinessError('Нейросеть сейчас не отвечает. Попробуйте позже.'); }
  const digest = parseDigest(answer);
  if (!digest) throw new BusinessError('Нейросеть ответила не по форме. Попробуйте ещё раз.');
  // The newest review read, taken from the database itself so the next «new reviews» check is exact.
  await db.query(
    `insert into "businessReviewDigest"(brand, flavor, "businessId", digest, "reviewCount", "lastReviewAt", model)
     select $1, $2, $3, $4, $5, max(r."createdAt"), $6 from review r where r.brand = $1 and r.flavor = $2
       and r."createdAt" <= $7::timestamptz + interval '1 millisecond' and ${NOT_BANNED}`,
    [brand, flavor, businessId, JSON.stringify(digest), reviews.length, client.model, reviews[0]!.createdAt]);
  return digest;
}

export interface DrinkSummary { body: ReviewDigest; reviewCount: number; createdAt: Date }

/** The latest summary of a drink for its page, or null when there is none yet. */
export async function getDrinkSummary(brand: string, flavor: string): Promise<DrinkSummary | null> {
  return (await getPool().query<DrinkSummary>(
    `select digest as body, "reviewCount", "createdAt" from "businessReviewDigest" where brand = $1 and flavor = $2 order by "createdAt" desc limit 1`, [brand, flavor])).rows[0] ?? null;
}

/**
 * Drinks the nightly run should (re)write: enough reviews, and either no summary yet or new reviews after it once the
 * cooldown has passed. Oldest summaries first, so a long backlog is worked through over several nights.
 */
export async function digestCandidates(limit: number): Promise<{ brand: string; flavor: string }[]> {
  return (await getPool().query<{ brand: string; flavor: string }>(
    `with drinks as (select r.brand, r.flavor, max(r."createdAt") as newest from review r where ${NOT_BANNED} group by 1, 2 having count(*) >= $1),
       latest as (select distinct on (brand, flavor) brand, flavor, "createdAt", "lastReviewAt" from "businessReviewDigest" order by brand, flavor, "createdAt" desc)
     select d.brand, d.flavor from drinks d left join latest l on l.brand = d.brand and l.flavor = d.flavor
     where l.brand is null or (d.newest > l."lastReviewAt" and l."createdAt" < now() - make_interval(hours => $2))
     order by l."createdAt" nulls first, d.newest desc limit $3`, [DIGEST_MIN_REVIEWS, DIGEST_COOLDOWN_HOURS, limit])).rows;
}

/** One pass over the candidates, one request at a time (the model's free plan is single-threaded). */
export async function runCatalogDigests(client: GigaChatClient, limit = 300, pauseMs = 1_000): Promise<{ written: number; failed: number }> {
  let written = 0, failed = 0;
  for (const drink of await digestCandidates(limit)) {
    try { await writeReviewDigest(drink.brand, drink.flavor, client, null); written++; }
    catch (error) { failed++; if (!(error instanceof BusinessError)) console.error('[review-digest] drink failed', error instanceof Error ? error.message : 'unknown'); }
    if (pauseMs) await new Promise(resolve => setTimeout(resolve, pauseMs));
  }
  return { written, failed };
}
