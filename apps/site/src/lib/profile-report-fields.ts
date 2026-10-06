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
export interface ReportState { error?: string; success?: string }
