/**
 * Черновик отзыва живёт в этом браузере или приложении: страница упала, связь пропала, приложение закрылось — написанное не потеряно.
 * Фото в черновик не входят: они не поместятся в хранилище. Хранилище может быть недоступно, поэтому все обращения — в try/catch.
 */
export interface ReviewDraft { text: string; design: number; taste: number; country: string; photos: number; savedAt: number }

export const REVIEW_DRAFT_DAYS = 7;
const PREFIX = 'canrush-review-draft:';
const key = (brand: string, flavor: string) => `${PREFIX}${JSON.stringify([brand, flavor])}`;

export function readReviewDraft(brand: string, flavor: string, now = Date.now()): ReviewDraft | null {
  try {
    const raw = localStorage.getItem(key(brand, flavor));
    if (!raw) return null;
    const draft = JSON.parse(raw) as Partial<ReviewDraft>;
    const fresh = typeof draft.savedAt === 'number' && now - draft.savedAt < REVIEW_DRAFT_DAYS * 86_400_000;
    if (!fresh || typeof draft.text !== 'string' || typeof draft.design !== 'number' || typeof draft.taste !== 'number') {
      localStorage.removeItem(key(brand, flavor));
      return null;
    }
    return { text: draft.text, design: draft.design, taste: draft.taste, country: typeof draft.country === 'string' ? draft.country : '', photos: typeof draft.photos === 'number' ? draft.photos : 0, savedAt: draft.savedAt as number };
  } catch {
    return null;
  }
}

export function writeReviewDraft(brand: string, flavor: string, draft: Omit<ReviewDraft, 'savedAt'>, now = Date.now()) {
  try { localStorage.setItem(key(brand, flavor), JSON.stringify({ ...draft, savedAt: now })); } catch { /* места нет или хранилище закрыто: отзыв всё равно можно отправить */ }
}

export function clearReviewDraft(brand: string, flavor: string) {
  try { localStorage.removeItem(key(brand, flavor)); } catch { /* нечего чистить */ }
}

/** При выходе из аккаунта: на общем устройстве следующий участник не должен увидеть чужой текст. */
export function clearAllReviewDrafts() {
  try {
    for (const name of Object.keys(localStorage)) if (name.startsWith(PREFIX)) localStorage.removeItem(name);
  } catch { /* нечего чистить */ }
}
