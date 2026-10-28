'use client';
import { useState } from 'react';
import Link from '@/components/navigation-progress';
import { FEATURE_LABELS, FOUNDER_MONTHLY, PLANS, PLAN_ORDER, rubles, type BusinessPlan } from '@/lib/business-plans';

/** What each column lists: the previous plan's features «+» what this one adds. */
const LISTS: Record<BusinessPlan, string[]> = {
  start: ['Отзывы на ваши напитки', 'Ответы от имени компании и шаблоны', 'Новые напитки без модерации', 'Правки карточек', 'Объявления от компании', `Команда до ${PLANS.start.members} человек`],
  brand: [`Команда до ${PLANS.brand.members} человек`, `История ${PLANS.brand.historyDays} дней`, `Конкуренты: до ${PLANS.brand.competitors}`, ...PLANS.brand.features.filter(item => item !== 'competitors').map(item => FEATURE_LABELS[item])],
  network: ['Любое число брендов', `Команда до ${PLANS.network.members} человек`, 'История за год', `Конкуренты: до ${PLANS.network.competitors}`],
};
const PREVIOUS: Partial<Record<BusinessPlan, string>> = { brand: 'Всё из «Старт», а также', network: 'Всё из «Бренд», а также' };

/** A column's foot: a link (a page of the site or a `mailto:`), the current plan's quiet mark, or a plain note. */
export type PlanAction = { label: string; href: string } | { label: string; current: true } | { note: string };

/**
 * The plans in the manner of linear.app/pricing: columns split by hairlines — name, price, the «Оплата за год» switch
 * (shared by the paid columns; a year is two months free, shown as the month's price), the list that builds on the
 * plan before, and the foot from `actions`. The landing and the cabinet both use it; the cabinet passes the plan in
 * force (`current`) and the founder price.
 */
export function BusinessPricing({ actions, badges = {}, current, founder = false }: {
  actions: Record<BusinessPlan, PlanAction>; badges?: Partial<Record<BusinessPlan, string>>; current?: BusinessPlan; founder?: boolean;
}) {
  const [yearly, setYearly] = useState(true);
  return <div className="biz-plans-box"><ul className="biz-plans">{PLAN_ORDER.map(key => {
    const plan = PLANS[key];
    const founderPrice = founder && key === 'brand';
    const month = founderPrice ? FOUNDER_MONTHLY : plan.monthly;
    const year = founderPrice ? FOUNDER_MONTHLY * 10 : plan.yearly;
    const monthly = yearly && year ? Math.round(year / 12) : month;
    const action = actions[key];
    return <li key={key} className="biz-plan" data-featured={key === 'brand' || undefined} data-current={key === current || undefined}>
      <h3>{plan.title}{badges[key] && <span className="biz-plan-badge">{badges[key]}</span>}</h3>
      <p className="biz-plan-price"><b>{monthly ? rubles(monthly) : '0 ₽'}</b>{monthly ? <small> в месяц</small> : null}</p>
      <div className="biz-plan-term">{plan.monthly
        ? <label className="biz-switch"><input type="checkbox" checked={yearly} onChange={event => setYearly(event.target.checked)} /><span aria-hidden="true" />
          {yearly ? `Оплата за год · ${rubles(year)}` : 'Оплата помесячно'}</label>
        : <span>Бесплатно навсегда</span>}</div>
      <ul>
        {PREVIOUS[key] && <li className="is-previous">{PREVIOUS[key]}</li>}
        {LISTS[key].map(item => <li key={item}>{item}</li>)}
      </ul>
      {'note' in action
        ? <p className="biz-plan-note">{action.note}</p>
        : 'current' in action
          ? <span className="biz-plan-cta is-current" aria-disabled="true">{action.label}</span>
          : action.href.startsWith('mailto:')
            ? <a className={`biz-plan-cta${key === 'brand' ? ' is-primary' : ''}`} href={action.href}>{action.label}</a>
            : <Link className={`biz-plan-cta${key === 'brand' ? ' is-primary' : ''}`} href={action.href}>{action.label}</Link>}
    </li>;
  })}</ul></div>;
}
