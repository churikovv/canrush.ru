import { getPool } from '@/db/pool';

/** What waits for the team in each admin section — the badges in the sidebar. */
export interface AdminQueues {
  support: number; reports: number; drinks: number; stores: number; articles: number; business: number;
}

/**
 * One query for every queue: support threads whose last word is the member's, open reports, drinks, stores and
 * articles on review, and for companies everything the team decides — applications, attached drinks, card edits,
 * plan requests and new promotion requests.
 */
export async function getAdminQueues(): Promise<AdminQueues> {
  const { rows } = await getPool().query<AdminQueues>(`select
    (select count(*) from "supportThread" where status = 'open' and not "lastFromStaff")::int as support,
    (select count(*) from "profileReport" where status = 'open')::int as reports,
    (select count(*) from "catalogDrink" where status = 'pending')::int as drinks,
    (select count(*) from "marketStore" where status = 'pending')::int as stores,
    (select count(*) from article where status = 'pending')::int as articles,
    ((select count(*) from business where status = 'pending')
      + (select count(*) from "businessDrink" where status = 'pending')
      + (select count(*) from "brandDrinkEdit" where status = 'pending')
      + (select count(*) from "businessPlanRequest" where status = 'pending')
      + (select count(*) from "businessPromoRequest" where status = 'new'))::int as business`);
  return rows[0]!;
}
