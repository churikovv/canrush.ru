import { FULL_STORE_PRICES, type HuntEvent, type HuntPhase, type huntProgress } from '@/lib/hunt-fields';

/** Что экран охоты получает с сервера: типы и подсказка лежат без базы данных, потому что их читает клиент. */
export interface HuntLevelView { level: number; stores: number; amount: number; reached: boolean; claimed: boolean }
export interface HuntOrderView { id: string; item: string; amount: number; status: 'new' | 'done' | 'cancelled'; note: string; createdAt: string }
export interface HuntStoreView { id: string; name: string; status: string; earned: number; prices: number; photo: boolean; located: boolean }
export interface HuntView {
  event: HuntEvent; phase: HuntPhase;
  /** Сколько проверенных магазинов у участника в этом событии: от них растёт дорожка бонусов. */
  network: number; reached: number; balance: number; limitLeft: number;
  /** Что можно забрать сейчас: награды за магазины и бонусы вместе. */
  ready: { count: number; amount: number };
  progress: ReturnType<typeof huntProgress>; levels: HuntLevelView[]; orders: HuntOrderView[]; stores: HuntStoreView[];
}

/** Что осталось на магазине: подсказка участнику, чего не хватает до полного. */
export function storeGaps(store: Pick<HuntStoreView, 'prices' | 'photo' | 'located'>) {
  return [
    ...(store.located ? [] : ['точка на карте']),
    ...(store.photo ? [] : ['фото']),
    ...(store.prices < FULL_STORE_PRICES ? [`ещё ${FULL_STORE_PRICES - store.prices} цен`] : []),
  ];
}
