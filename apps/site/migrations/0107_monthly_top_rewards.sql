-- Награды топа месяца вдвое выше: +1000 / +600 / +300 XP вместо +500 / +300 / +150 (MONTHLY_TOP_REWARDS в
-- src/lib/monthly-top.ts — те же числа). Уже подведённые месяцы не пересчитываются: выплаченное остаётся как было.
create or replace function settle_monthly_top(at timestamptz default now()) returns void language plpgsql as $$
declare
  period date := (date_trunc('month', at at time zone 'Europe/Moscow') - interval '1 month')::date;
  winner record;
  prize integer;
begin
  if period < date '2026-10-01' or exists(select 1 from "monthlyTopSettlement" where month = period) then return; end if;
  perform pg_advisory_xact_lock(hashtext('canrush:monthly-top'));
  insert into "monthlyTopSettlement" (month) values (period) on conflict do nothing;
  if not found then return; end if;
  for winner in
    select x."userId", sum(x.points)::int as xp, row_number() over (order by sum(x.points) desc, max(x."createdAt"), x."userId")::int as place
    from "profileExperience" x join "user" u on u.id = x."userId"
    where x.reason <> 'monthly-top' and x."createdAt" <@ monthly_top_bounds(period)
      and u.username is not null and not exists(select 1 from "userBlock" b where b."userId" = u.id)
    group by x."userId" order by place limit 3
  loop
    prize := case winner.place when 1 then 1000 when 2 then 600 else 300 end;
    insert into "monthlyTopAward" (month, place, "userId", xp, reward) values (period, winner.place, winner."userId", winner.xp, prize);
    insert into "profileExperience" ("userId", reason, "sourceKey", points) values (winner."userId", 'monthly-top', to_char(period, 'YYYY-MM'), prize) on conflict do nothing;
    insert into "profileAchievement" ("userId", key) values (winner."userId", 'top') on conflict do nothing;
    insert into notification ("userId", kind, "eventKey", payload)
      values (winner."userId", 'monthly-top', 'monthly-top:' || to_char(period, 'YYYY-MM'), jsonb_build_object('month', to_char(period, 'YYYY-MM'), 'place', winner.place, 'reward', prize))
      on conflict do nothing;
  end loop;
end $$;
