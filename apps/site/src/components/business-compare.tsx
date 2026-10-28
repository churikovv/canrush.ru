import { FEATURE_LABELS, PLANS, PLAN_ORDER, type BusinessPlan, type PlanFeature } from '@/lib/business-plans';

const yes = (plan: BusinessPlan, feature: PlanFeature) => PLANS[plan].features.includes(feature);
const COMPARE_GROUPS: { title: string; rows: [string, ...(boolean | string)[]][] }[] = [
  { title: 'Отзывы и каталог', rows: [
    ['Отзывы на ваши напитки', true, true, true], ['Ответы от имени компании', true, true, true], ['Шаблоны ответов', true, true, true],
    ['Новые напитки без модерации', true, true, true], ['Правки карточек', true, true, true], ['Объявления от компании', true, true, true],
  ] },
  { title: 'Аналитика', rows: [
    ['Обзор и очередь ответов', true, true, true],
    ...(['search', 'cards', 'insights', 'report', 'export'] as const).map(feature => [FEATURE_LABELS[feature], ...PLAN_ORDER.map(plan => yes(plan, feature))] as [string, ...boolean[]]),
    ['Конкуренты', ...PLAN_ORDER.map(plan => PLANS[plan].competitors ? `до ${PLANS[plan].competitors}` : false)],
    ['История', ...PLAN_ORDER.map(plan => PLANS[plan].historyDays === 365 ? 'год' : `${PLANS[plan].historyDays} дней`)],
  ] },
  { title: 'Команда', rows: [
    ['Человек в команде', ...PLAN_ORDER.map(plan => `до ${PLANS[plan].members}`)],
    ['Брендов в кабинете', ...PLAN_ORDER.map(plan => PLANS[plan].brands === Infinity ? 'любое' : String(PLANS[plan].brands))],
    ['Роли: менеджер и аналитик', true, true, true],
    [FEATURE_LABELS.log, ...PLAN_ORDER.map(plan => yes(plan, 'log'))],
  ] },
  { title: 'Закупки', rows: [
    [FEATURE_LABELS.wholesale, ...PLAN_ORDER.map(plan => yes(plan, 'wholesale'))],
  ] },
];

/** «Сравнение тарифов»: every capability per plan — a tick, a cross or the number — grouped like linear.app/pricing. */
export function BusinessCompare({ title = 'Сравнение тарифов' }: { title?: string }) {
  return <div className="biz-compare">
    <h3>{title}</h3>
    <table>
      <thead><tr><th><span className="sr-only">Возможность</span></th>{PLAN_ORDER.map(key => <th key={key} scope="col">{PLANS[key].title}</th>)}</tr></thead>
      {COMPARE_GROUPS.map(group => <tbody key={group.title}>
        <tr className="biz-compare-group"><th scope="rowgroup" colSpan={4}>{group.title}</th></tr>
        {group.rows.map(([label, ...values]) => <tr key={label}><th scope="row">{label}</th>{values.map((value, index) => <td key={index}>
          {value === true ? <span className="biz-yes" aria-label="есть" /> : value === false ? <span className="biz-no" aria-label="нет" /> : value}
        </td>)}</tr>)}
      </tbody>)}
    </table>
  </div>;
}
