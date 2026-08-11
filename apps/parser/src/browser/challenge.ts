import type { Page, Response } from 'playwright';

export type ChallengeState = 'clear' | 'challenge' | 'blocked';

/** Признаки временного JS/PoW-челленджа, который может пройти сам (WB, Cloudflare-like). */
const CHALLENGE_MARKERS = [
  'проверяем браузер',
  'checking your browser',
  'я не робот',
  'подтвердите, что вы не робот',
  'антибот',
];

/** Признаки жёсткой блокировки, повторные попытки бессмысленны без смены сессии/IP. */
const BLOCKED_MARKERS = [
  '403 forbidden',
  'доступ к сайту',
  'доступ запрещен',
  'access denied',
  'похоже, нет соединения',
];

function classifyByStatus(status: number | undefined): ChallengeState | null {
  if (status === undefined) return null;
  // 401 у некоторых источников (например, Qrator на lenta.com) — это временный
  // JS-челлендж перед реальным контентом, а не хардбан: реальный браузер обычно
  // проходит его сам за несколько секунд, поэтому даём шанс через waitForClear.
  if (status === 429 || status === 498 || status === 401) return 'challenge';
  if (status === 403) return 'blocked';
  return null;
}

/**
 * Чистая классификация состояния страницы по HTTP-статусу и тексту body —
 * без зависимости от Playwright, чтобы можно было покрыть unit-тестами.
 */
export function classifyChallenge(bodyText: string, status?: number): ChallengeState {
  const byStatus = classifyByStatus(status);
  if (byStatus) return byStatus;

  const lower = bodyText.toLowerCase();
  if (CHALLENGE_MARKERS.some((marker) => lower.includes(marker))) return 'challenge';
  if (BLOCKED_MARKERS.some((marker) => lower.includes(marker))) return 'blocked';
  return 'clear';
}

/** Определяет текущее состояние страницы: чисто / нужен челлендж / заблокировано. */
export async function detectChallenge(page: Page, response?: Response | null): Promise<ChallengeState> {
  const status = response?.status();
  if (classifyByStatus(status)) {
    return classifyChallenge('', status);
  }

  const bodyText = (await page.textContent('body').catch(() => null)) ?? '';
  return classifyChallenge(bodyText, status);
}

/**
 * Ждёт, пока временный челлендж пройдёт сам (JS proof-of-work и т.п.), опрашивая
 * страницу раз в секунду. Если за timeoutMs состояние не станет "clear", возвращает
 * последнее увиденное состояние — вызывающий код решает, бросать ChallengeRequiredError
 * или SourceBlockedError.
 */
export async function waitForClear(page: Page, timeoutMs = 15_000): Promise<ChallengeState> {
  const deadline = Date.now() + timeoutMs;
  let state = await detectChallenge(page);

  while (state === 'challenge' && Date.now() < deadline) {
    await page.waitForTimeout(1000);
    state = await detectChallenge(page);
  }

  return state;
}
