export const DELIVERY = { yandex: 'Яндекс', avito: 'Авито', cdek: 'Сдэк', post: 'Почта России', x5: 'X5 Post', pickup: 'Самовывоз' } as const;
export type Delivery = keyof typeof DELIVERY;
export type OrderStatus = 'new' | 'confirmed' | 'completed' | 'cancelled';
export const ORDER_STATUS: Record<OrderStatus, string> = { new: 'Новый', confirmed: 'Подтверждён', completed: 'Завершён', cancelled: 'Отменён' };
export class MarketError extends Error {}
export function marketId(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new MarketError('Объект не найден.');
  return value;
}
export function parseQuantity(value: unknown): number {
  const raw = typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '';
  const quantity = Number(raw);
  if (!/^\d{1,6}$/.test(raw) || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100000) throw new MarketError('Укажите целое количество от 1 до 100 000 шт.');
  return quantity;
}
export function parseListing(form: FormData) {
  const text = (key: string, max: number) => {
    const value = form.get(key);
    if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new MarketError(`Заполните ${key === 'title' ? 'название (до 120 символов)' : key === 'city' ? 'город (до 100 символов)' : 'описание (до 5000 символов)'}.`);
    return value.trim();
  };
  const anyCity = form.get('anyCity') === 'on';
  const title = text('title', 120), description = text('description', 5000), city = anyCity ? 'Любой город' : text('city', 100);
  const brand = typeof form.get('brand') === 'string' ? String(form.get('brand')).trim() : '';
  if (!brand || brand.length > 100) throw new MarketError('Выберите бренд.');
  const raw = String(form.get('price') ?? '').trim().replace(',', '.');
  const price = Math.round(Number(raw) * 100);
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(raw) || !Number.isSafeInteger(price) || price < 1 || price > 1_000_000_000) throw new MarketError('Укажите цену от 0,01 до 10 000 000 ₽, не более двух знаков после запятой.');
  const delivery = [...new Set(form.getAll('delivery'))];
  if (!delivery.length || delivery.some(value => typeof value !== 'string' || !Object.hasOwn(DELIVERY, value))) throw new MarketError('Выберите хотя бы один способ доставки.');
  return { title, description, city, brand, anyCity, price, quantity: parseQuantity(form.get('quantity')), delivery: delivery as Delivery[] };
}
export type ListingInput = Omit<ReturnType<typeof parseListing>, 'brand' | 'anyCity'> & { brand?: string | null; anyCity?: boolean };
export interface MarketFilters { brand?: string; city?: string; delivery?: string }
export function canTransitionOrder(from: OrderStatus, to: OrderStatus, role: 'buyer' | 'seller') {
  return ((from === 'new' || from === 'confirmed') && to === 'cancelled')
    || (from === 'new' && to === 'confirmed' && role === 'seller')
    || (from === 'confirmed' && to === 'completed' && role === 'buyer');
}
export function formatPrice(price: number) { return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: price % 100 ? 2 : 0 }).format(price / 100); }
