/**
 * «Охота за ценниками»: правила без базы данных. Ценник — своя валюта события: зарабатывается только данными о магазинах, тратится только
 * на витрине, 1 ценник = 1 ₽, а после события сгорает. С опытом, крышками и крутками не связан ни в какую сторону: иначе случайные награды
 * получили бы денежную цену. Суммы заданий и бонусов повторяет триггер `hunt_store_trigger` (миграция `0176`), меняй вместе.
 */

export const HUNT_TAG_FORMS = ['ценник', 'ценника', 'ценников'] as const;
export const HUNT_MIN_CASHOUT = 100;
export const HUNT_LOOP_SECONDS = 6;

export type HuntTaskKey = 'full' | 'upgrade' | 'big';
export const HUNT_TASKS: readonly { key: HuntTaskKey; title: string; hint: string; amount: number }[] = [
  { key: 'full', title: 'Новый полный магазин', hint: 'Точка на карте, фото и 5+ напитков с ценами', amount: 20 },
  { key: 'upgrade', title: 'Старый магазин стал полным', hint: 'Дополните магазин, добавленный до начала события', amount: 10 },
  { key: 'big', title: 'Большой ассортимент', hint: '15+ напитков с ценами', amount: 10 },
];
export const FULL_STORE_PRICES = 5;

export interface HuntLevel { stores: number; amount: number }
/** Бонусы к сумме за число проверенных магазинов в событии: 20 магазинов по 20 ценников и 100 бонусами — 500 ценников. */
export const HUNT_LEVELS: readonly HuntLevel[] = [
  { stores: 5, amount: 10 },
  { stores: 10, amount: 20 },
  { stores: 15, amount: 30 },
  { stores: 20, amount: 40 },
];

/**
 * Магазин растёт с уровнем: `from` — уровень, на котором стадия открывается. Сцены — `public/brand/hunt/store-<номер стадии>`,
 * рендер — `marketing/design/3d/build_hunt_store.py`. В кадре только наше имя: ни чужих брендов, ни настоящих сетей.
 */
export const HUNT_STAGES: readonly { from: number; name: string; line: string }[] = [
  { from: 0, name: 'Ларёк', line: 'Прилавок и ящик банок. С него начинается ваша сеть.' },
  { from: 1, name: 'Киоск', line: 'Вывеска и свой холодильник.' },
  { from: 2, name: 'Магазин у дома', line: 'Витрина, неон и ценники вокруг.' },
  { from: 3, name: 'Супермаркет', line: 'Золотой фасад и тележки у входа.' },
  { from: 4, name: 'Флагман', line: 'Башня с экраном. Сеть из 20 магазинов.' },
];

export const huntStage = (level: number) => HUNT_STAGES.filter(stage => level >= stage.from).length;
export const huntStageOpensAt = (level: number) => (level > 0 ? HUNT_STAGES.find(stage => stage.from === level) : undefined);
export const huntLevelReached = (stores: number) => HUNT_LEVELS.filter(level => stores >= level.stores).length;

/** Сколько магазинов до следующего бонуса и доля пройденного пути к нему; после последнего — `null`. */
export function huntProgress(stores: number) {
  const reached = huntLevelReached(stores);
  const next = HUNT_LEVELS[reached];
  if (!next) return null;
  const from = HUNT_LEVELS[reached - 1]?.stores ?? 0;
  return { left: next.stores - stores, share: (stores - from) / (next.stores - from) };
}

/** Даты строкой: так их можно передать в браузер. `endsAt`, `reviewUntil` и `burnsAt` — первая минута дня, который уже не входит. */
export interface HuntEvent { key: string; startsAt: string; endsAt: string; reviewUntil: string; burnsAt: string; memberLimit: number }
export type HuntPhase = 'upcoming' | 'open' | 'exchange' | 'over';

export function huntPhase(event: HuntEvent, now: number): HuntPhase {
  if (now < Date.parse(event.startsAt)) return 'upcoming';
  if (now < Date.parse(event.endsAt)) return 'open';
  return now < Date.parse(event.burnsAt) ? 'exchange' : 'over';
}

const moscowDate = (time: number) => new Date(time).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow', day: 'numeric', month: 'long' });
export const huntFirstDay = (iso: string) => moscowDate(Date.parse(iso));
/** Последний день, который ещё входит в срок. */
export const huntLastDay = (iso: string) => moscowDate(Date.parse(iso) - 1);

/** Порог обмена действует, пока идёт приём: потом он сжёг бы мелкие суммы тех, кто честно добавил пару магазинов. */
export const huntMinCashout = (phase: HuntPhase) => (phase === 'exchange' ? 1 : HUNT_MIN_CASHOUT);

export type HuntItemKind = 'cash' | 'goods';
export interface HuntItem { key: string; kind: HuntItemKind; name: string; line: string; price: number | null; soon?: boolean }
/**
 * Витрина. Новый товар — новая запись: убери `soon`, поставь `price`. Ключ пишется в заявку, его потом не меняй.
 * У рублей цена не задана: участник сам выбирает сумму.
 */
export const HUNT_ITEMS: readonly HuntItem[] = [
  { key: 'rub', kind: 'cash', name: 'Рубли на карту', line: '1 ценник = 1 ₽, по СБП или на карту', price: null },
  { key: 'tshirt', kind: 'goods', name: 'Футболка CanRush', line: 'Скоро на витрине', price: null, soon: true },
  { key: 'mug', kind: 'goods', name: 'Кружка CanRush', line: 'Скоро на витрине', price: null, soon: true },
];

export class HuntError extends Error {}

export type HuntPayout = { method: 'sbp'; phone: string; bank: string } | { method: 'card'; number: string };

/** Контрольная сумма номера карты: ловит опечатку до заявки. */
function luhn(digits: string) {
  let sum = 0;
  for (let index = 0; index < digits.length; index += 1) {
    const digit = Number(digits[digits.length - 1 - index]);
    const doubled = index % 2 === 1 ? digit * 2 : digit;
    sum += doubled > 9 ? doubled - 9 : doubled;
  }
  return sum % 10 === 0;
}

/** Реквизиты выплаты: телефон и банк для СБП или только номер карты. Срок действия и CVC не спрашиваем и не принимаем. */
export function parseHuntPayout(input: { method?: unknown; phone?: unknown; bank?: unknown; number?: unknown }): HuntPayout {
  if (input.method === 'sbp') {
    const digits = String(input.phone ?? '').replace(/\D/gu, '');
    const local = digits.length === 11 && /^[78]/u.test(digits) ? digits.slice(1) : digits;
    if (!/^9\d{9}$/u.test(local)) throw new HuntError('Укажите мобильный номер: +7 и 10 цифр.');
    const bank = String(input.bank ?? '').trim().replace(/\s+/gu, ' ');
    if (bank.length < 2 || bank.length > 60) throw new HuntError('Укажите банк для перевода по СБП.');
    return { method: 'sbp', phone: `+7${local}`, bank };
  }
  if (input.method === 'card') {
    const number = String(input.number ?? '').replace(/[\s-]/gu, '');
    if (!/^\d{13,19}$/u.test(number) || !luhn(number)) throw new HuntError('Проверьте номер карты.');
    return { method: 'card', number };
  }
  throw new HuntError('Выберите, куда перевести рубли.');
}

export const huntPayoutLabel = (payout: HuntPayout) => (payout.method === 'sbp' ? `СБП ${payout.phone}, ${payout.bank}` : `Карта ${payout.number.replace(/(\d{4})(?=\d)/gu, '$1 ')}`);

export interface HuntOrderInput { item?: unknown; amount?: unknown; confirmed?: unknown; payout?: Parameters<typeof parseHuntPayout>[0] }

/** Что просит участник: товар витрины по его цене, рубли — на выбранную сумму, с реквизитами и подтверждением возраста. */
export function parseHuntOrder(input: HuntOrderInput, phase: HuntPhase): { item: HuntItem; amount: number; payout: HuntPayout | null } {
  const item = HUNT_ITEMS.find(entry => entry.key === input.item);
  if (!item || item.soon) throw new HuntError('Этого товара нет на витрине.');
  if (item.kind === 'goods') {
    if (!item.price) throw new HuntError('Этого товара нет на витрине.');
    return { item, amount: item.price, payout: null };
  }
  const amount = Number(input.amount);
  const least = huntMinCashout(phase);
  if (!Number.isInteger(amount) || amount < least) throw new HuntError(`Обмен — от ${least} ценников.`);
  if (input.confirmed !== true) throw new HuntError('Подтвердите, что вам есть 18 лет.');
  return { item, amount, payout: parseHuntPayout(input.payout ?? {}) };
}

export const HUNT_ORDER_STATUS: Record<'new' | 'done' | 'cancelled', string> = { new: 'Ждёт выплаты', done: 'Выполнена', cancelled: 'Отменена' };
export const huntItemName = (key: string) => HUNT_ITEMS.find(item => item.key === key)?.name ?? key;
