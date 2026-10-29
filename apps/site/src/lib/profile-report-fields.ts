export const REPORT_REASONS = {
  scam: 'Скам',
  spam: 'Спам',
  insults: 'Оскорбления',
  prohibited: 'Запрещенный контент',
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;
export function reportReason(value: string): ReportReason | null {
  return Object.hasOwn(REPORT_REASONS, value) ? value as ReportReason : null;
}
/** After a sent report the dialog offers to block the author. */
export interface ReportState { error?: string; success?: string; author?: { id: string; name: string; blocked: boolean } }

/** What a content report points at; keys are stored in "profileReport"."contentKind" (check in 0084). */
export const CONTENT_REPORT_KINDS = {
  review: 'Отзыв',
  'review-comment': 'Комментарий к отзыву',
  'tier-list': 'Тирлист',
  'tier-comment': 'Комментарий к тирлисту',
  'wall-post': 'Запись на стене',
  'wall-reply': 'Комментарий к записи',
  'market-listing': 'Объявление',
  'market-message': 'Сообщение в заказе',
  store: 'Магазин',
  story: 'История',
  article: 'Статья',
  'business-post': 'Запись компании',
} as const;
export type ContentReportKind = keyof typeof CONTENT_REPORT_KINDS;
export function contentReportKind(value: string): ContentReportKind | null {
  return Object.hasOwn(CONTENT_REPORT_KINDS, value) ? value as ContentReportKind : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
export function isContentId(value: string): boolean {
  return UUID.test(value);
}

/** Same-site page the report was sent from, for the admin's link; anything else is dropped. */
export function reportPagePath(value: string): string | null {
  return /^\/[^/\\]/u.test(value) && value.length <= 300 ? value : null;
}
