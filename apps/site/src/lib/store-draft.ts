import type { StockStatus } from '@/lib/store-fields';

/**
 * Черновик формы магазина живёт в этом браузере или приложении: страницу обновили, связь пропала, приложение закрылось — заполненное
 * возвращается. Как и у отзывов, фото в него не входят: они не поместятся в хранилище. Хранилище может быть недоступно и правится руками,
 * поэтому все обращения в try, а прочитанное проверяется как чужой текст. `version` — дата правки магазина: черновик старой версии не накладываем.
 */
export interface StoreDraftRow { id: string; name: string; price: string; availability: StockStatus; brand?: string; flavor?: string }
export interface StoreDraft {
  version: string; name: string; description: string; address: string; city: string;
  latitude: string; longitude: string; source: '' | 'manual' | 'geocoded'; metro: string;
  items: StoreDraftRow[]; step: number; photos: number; savedAt: number;
}

export const STORE_DRAFT_DAYS = 7;
const PREFIX = 'canrush-store-draft:';
const STOCK = ['available', 'unavailable', 'unknown'];
const key = (storeId: string | null) => `${PREFIX}${storeId ?? 'new'}`;

function validRow(value: unknown): value is StoreDraftRow {
  if (typeof value !== 'object' || value === null) return false;
  const { id, name, price, availability, brand, flavor } = value as Partial<StoreDraftRow>;
  return typeof id === 'string' && typeof name === 'string' && typeof price === 'string' && STOCK.includes(availability ?? '')
    && (brand === undefined || (typeof brand === 'string' && typeof flavor === 'string'));
}

function validDraft(value: Partial<StoreDraft>): value is StoreDraft {
  return [value.version, value.name, value.description, value.address, value.city, value.latitude, value.longitude, value.metro].every(field => typeof field === 'string')
    && ['', 'manual', 'geocoded'].includes(value.source ?? 'x') && Array.isArray(value.items) && value.items.every(validRow)
    && typeof value.step === 'number' && typeof value.photos === 'number' && typeof value.savedAt === 'number';
}

export function readStoreDraft(storeId: string | null, version: string, now = Date.now()): StoreDraft | null {
  try {
    const raw = localStorage.getItem(key(storeId));
    if (!raw) return null;
    const draft = JSON.parse(raw) as Partial<StoreDraft>;
    if (!validDraft(draft) || draft.version !== version || now - draft.savedAt >= STORE_DRAFT_DAYS * 86_400_000) {
      localStorage.removeItem(key(storeId));
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

export function writeStoreDraft(storeId: string | null, draft: Omit<StoreDraft, 'savedAt'>, now = Date.now()) {
  try { localStorage.setItem(key(storeId), JSON.stringify({ ...draft, savedAt: now })); } catch { /* места нет или хранилище закрыто: форму всё равно можно отправить */ }
}

export function clearStoreDraft(storeId: string | null) {
  try { localStorage.removeItem(key(storeId)); } catch { /* нечего чистить */ }
}

/** При выходе из аккаунта: на общем устройстве следующий участник не должен увидеть чужой магазин. */
export function clearAllStoreDrafts() {
  try {
    for (const name of Object.keys(localStorage)) if (name.startsWith(PREFIX)) localStorage.removeItem(name);
  } catch { /* нечего чистить */ }
}
