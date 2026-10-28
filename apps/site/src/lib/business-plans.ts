/** Business plans — shared by the server (limits) and the pages (cards, locks). Prices in rubles. */
export type BusinessPlan = 'start' | 'brand' | 'network';
/** What a plan opens beyond «Старт». */
export type PlanFeature = 'search' | 'cards' | 'competitors' | 'insights' | 'report' | 'export' | 'log';

export interface PlanInfo {
  key: BusinessPlan; title: string; monthly: number; yearly: number; hint: string;
  /** People in the team, the owner included. */
  members: number; competitors: number;
  /** How far back analytics may look. */
  historyDays: number;
  /** Brands a company may attach drinks of; Infinity — any. */
  brands: number;
  features: PlanFeature[];
}

const ALL: PlanFeature[] = ['search', 'cards', 'competitors', 'insights', 'report', 'export', 'log'];
export const PLANS: Record<BusinessPlan, PlanInfo> = {
  start: { key: 'start', title: 'Старт', monthly: 0, yearly: 0, hint: 'Отзывы, ответы покупателям и карточки напитков', members: 2, competitors: 0, historyDays: 30, brands: 1, features: [] },
  brand: { key: 'brand', title: 'Бренд', monthly: 4900, yearly: 49000, hint: 'Вся аналитика одного бренда и команда', members: 5, competitors: 3, historyDays: 90, brands: 1, features: ALL },
  network: { key: 'network', title: 'Сеть', monthly: 14900, yearly: 149000, hint: 'Для дистрибьюторов и сетей: много брендов и год истории', members: 15, competitors: 10, historyDays: 365, brands: Infinity, features: ALL },
};
export const PLAN_ORDER: BusinessPlan[] = ['start', 'brand', 'network'];
/** The founder price of «Бренд» for the first companies, a month. */
export const FOUNDER_MONTHLY = 2900;
/** How many first approved companies get the pilot. */
export const PILOT_COMPANIES = 20;
export const PILOT_DAYS = 90;

export const FEATURE_LABELS: Record<PlanFeature, string> = {
  search: 'Аналитика поиска', cards: 'Аналитика карточек', competitors: 'Сравнение с конкурентами', insights: 'Разбор отзывов нейросетью',
  report: 'Еженедельный отчёт на почту', export: 'Экспорт CSV', log: 'Журнал действий команды',
};

/** The plan in force: a paid plan past its date is «Старт» again. */
export function effectivePlan(business: { plan?: BusinessPlan | null; planUntil?: Date | string | null }, now = new Date()): BusinessPlan {
  const plan = business.plan ?? 'start';
  if (plan === 'start') return plan;
  return business.planUntil && new Date(business.planUntil) > now ? plan : 'start';
}
export const planInfo = (business: Parameters<typeof effectivePlan>[0]) => PLANS[effectivePlan(business)];
export const hasFeature = (business: Parameters<typeof effectivePlan>[0], feature: PlanFeature) => planInfo(business).features.includes(feature);
/** The cheapest plan that has the feature, for «Доступно в тарифе …». */
export const planFor = (feature: PlanFeature): PlanInfo => PLAN_ORDER.map(key => PLANS[key]).find(plan => plan.features.includes(feature))!;
/** History windows to pick from, within the plan. */
export const HISTORY_WINDOWS = [30, 90, 365] as const;

export const rubles = (value: number) => `${value.toLocaleString('ru-RU')} ₽`;

/** The form of «Оплата по счёту»: plan, period and the payer's requisites. */
export interface PlanRequestInput { plan: 'brand' | 'network'; period: 'month' | 'year'; payer: string; inn: string; email: string; comment: string | null }
export class PlanRequestError extends Error {}
const text = (form: FormData, key: string) => { const value = form.get(key); return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''; };
export function parsePlanRequest(form: FormData): PlanRequestInput {
  const plan = text(form, 'plan'), period = text(form, 'period');
  if (plan !== 'brand' && plan !== 'network') throw new PlanRequestError('Выберите тариф.');
  if (period !== 'month' && period !== 'year') throw new PlanRequestError('Выберите срок: месяц или год.');
  const payer = text(form, 'payer'), inn = text(form, 'inn').replace(/\D/g, ''), email = text(form, 'email').toLowerCase(), comment = text(form, 'comment');
  if (payer.length < 2 || payer.length > 200) throw new PlanRequestError('Укажите плательщика: название организации или ИП.');
  if (inn.length !== 10 && inn.length !== 12) throw new PlanRequestError('ИНН — 10 цифр у организации или 12 у ИП.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new PlanRequestError('Проверьте почту для счёта.');
  if (comment.length > 500) throw new PlanRequestError('Комментарий — до 500 символов.');
  return { plan, period, payer, inn, email, comment: comment || null };
}
export const planPrice = (plan: BusinessPlan, period: 'month' | 'year', founder = false) =>
  plan === 'brand' && founder ? (period === 'month' ? FOUNDER_MONTHLY : FOUNDER_MONTHLY * 10) : period === 'month' ? PLANS[plan].monthly : PLANS[plan].yearly;

export type PromoPlacement = 'picks' | 'dating' | 'catalog' | 'stories';
export const PROMO_PLACEMENTS: { value: PromoPlacement; label: string; hint: string }[] = [
  { value: 'picks', label: '«Тебе понравится»', hint: 'Рекомендации тем, кому нравятся похожие вкусы' },
  { value: 'dating', label: 'Дейтинг напитков', hint: 'Карточка в колоде свайпов' },
  { value: 'catalog', label: 'Каталог', hint: 'Место в подборках каталога' },
  { value: 'stories', label: 'Истории', hint: 'История на главной' },
];
export interface PromoRequestInput { placement: PromoPlacement; budget: number; comment: string | null }
export function parsePromoRequest(form: FormData): PromoRequestInput {
  const placement = text(form, 'placement') as PromoPlacement;
  if (!PROMO_PLACEMENTS.some(item => item.value === placement)) throw new PlanRequestError('Выберите, где показать.');
  const budget = Number(text(form, 'budget').replace(/\s/g, ''));
  if (!Number.isInteger(budget) || budget < 1000 || budget > 10_000_000) throw new PlanRequestError('Бюджет — от 1 000 ₽, целым числом.');
  const comment = text(form, 'comment');
  if (comment.length > 1000) throw new PlanRequestError('Комментарий — до 1000 символов.');
  return { placement, budget, comment: comment || null };
}
