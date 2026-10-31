/** Сдвиг указателя меньше этого — обычное нажатие, а не бросок. */
export const DRAG_SLOP = 8;
/** Скорость вверх в px/мс, с которой карта считается брошенной, даже если её отпустили ещё над рукой. */
const FLICK_SPEED = 0.6;
/** Если указатель постоял перед отпусканием дольше этого, броска не было: карту просто положили. */
export const FLICK_WINDOW_MS = 90;

/** Долетела ли карта до стола: отпущена выше руки или брошена вверх. */
export function releasedOnTable(y: number, handTop: number, speed: number) {
  return y < handTop || speed >= FLICK_SPEED;
}
