import { BusinessError } from '@/lib/business-fields';

/**
 * Rules of a company's public profile (/company/<id>), shared by the browser and the server: which sections it shows
 * and what a wall post with a PDF presentation may be.
 */
export type ProfileSection = 'store' | 'presentations' | 'drinks' | 'listings' | 'awards';
export const PROFILE_SECTIONS: { key: ProfileSection; label: string; hint: string }[] = [
  { key: 'store', label: 'Магазин', hint: 'кнопка «Перейти в магазин» и адрес' },
  { key: 'presentations', label: 'Презентации', hint: 'стена с PDF и новостями компании' },
  { key: 'drinks', label: 'Напитки', hint: 'подтверждённые напитки компании из каталога' },
  { key: 'listings', label: 'Объявления', hint: 'открытые объявления маркета от компании' },
  { key: 'awards', label: 'Награды', hint: 'дипломы и сертификаты: вкладка появится с первой наградой' },
];
export const isProfileSection = (value: unknown): value is ProfileSection => PROFILE_SECTIONS.some(section => section.key === value);

/** Sections the team switched off; everything is on by default. */
export function parseHiddenSections(form: FormData): ProfileSection[] {
  return PROFILE_SECTIONS.filter(section => form.get(`show-${section.key}`) !== 'on').map(section => section.key);
}

export const MAX_POST_TEXT = 1000;
/** Photos on one wall post (news with pictures). */
export const MAX_POST_PHOTOS = 4;
export const MAX_PDF_BYTES = 20 * 1024 * 1024;
export const MAX_PDF_NAME = 120;

/** A post's text: trimmed, at most `MAX_POST_TEXT`; empty only next to a file. */
export function parsePostText(value: unknown): string {
  const text = String(value ?? '').replace(/\r\n?/gu, '\n').replace(/\n{3,}/gu, '\n\n').trim();
  if (text.length > MAX_POST_TEXT) throw new BusinessError(`Текст записи — до ${MAX_POST_TEXT} символов.`);
  return text;
}

/** The name the file is shown and downloaded under: no path, no control characters, ends in .pdf. */
export function pdfFileName(name: string): string {
  const base = name.split(/[\\/]/u).at(-1)!.replace(/[\u0000-\u001f\u007f"]/gu, '').replace(/\s+/gu, ' ').trim().replace(/\.pdf$/iu, '');
  return `${(base || 'Презентация').slice(0, MAX_PDF_NAME - 4)}.pdf`;
}

/** A PDF is told by its content (`%PDF-` at the start), not by the browser's type or the file's name. */
export function isPdf(data: Uint8Array): boolean {
  return data.length > 5 && String.fromCharCode(...data.subarray(0, 5)) === '%PDF-';
}

/** «2,4 МБ» / «820 КБ» for the file card. */
export function fileSizeLabel(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} МБ` : `${Math.max(1, Math.round(bytes / 1024))} КБ`;
}

export const MAX_AWARDS = 30;
export const MAX_AWARD_TITLE = 120;
export const MAX_AWARD_ISSUER = 120;

export interface AwardInput { title: string; issuer: string | null; year: number | null }

/** An award's name, who gave it and the year: the name is required, the rest may stay empty. */
export function parseAwardInput(form: FormData, now = new Date()): AwardInput {
  const line = (name: string) => String(form.get(name) ?? '').replace(/\s+/gu, ' ').trim();
  const title = line('title');
  if (!title) throw new BusinessError('Напишите название награды.');
  if (title.length > MAX_AWARD_TITLE) throw new BusinessError(`Название — до ${MAX_AWARD_TITLE} символов.`);
  const issuer = line('issuer');
  if (issuer.length > MAX_AWARD_ISSUER) throw new BusinessError(`«Кто вручил» — до ${MAX_AWARD_ISSUER} символов.`);
  const rawYear = line('year');
  const year = rawYear ? Number(rawYear) : null;
  if (year !== null && (!Number.isInteger(year) || year < 1900 || year > now.getFullYear() + 1)) throw new BusinessError('Год указан неверно.');
  return { title, issuer: issuer || null, year };
}

export const MAX_BIO = 160;
export const MAX_STORY = 4000;
/** What the brand writes about itself on its profile: a short line under the name, a long story and public contacts. */
export interface CompanyInfo { bio: string | null; story: string | null; publicEmail: string | null; phone: string | null; address: string | null }

const field = (form: FormData, name: string) => String(form.get(name) ?? '').trim();

/** The owner's profile texts and contacts: trimmed, empty becomes null, contacts checked by shape. */
export function parseCompanyInfo(form: FormData): CompanyInfo {
  const bio = field(form, 'bio').replace(/\s+/gu, ' ');
  if (bio.length > MAX_BIO) throw new BusinessError(`Короткое описание — до ${MAX_BIO} символов.`);
  const story = field(form, 'story').replace(/\r\n?/gu, '\n').replace(/\n{3,}/gu, '\n\n');
  if (story.length > MAX_STORY) throw new BusinessError(`Рассказ о бренде — до ${MAX_STORY} символов.`);
  const publicEmail = field(form, 'publicEmail');
  if (publicEmail && (publicEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(publicEmail))) throw new BusinessError('Почта для покупателей указана неверно.');
  const phone = field(form, 'phone').replace(/\s+/gu, ' ');
  if (phone && (!/^\+?[\d\s()-]{5,24}$/u.test(phone) || (phone.match(/\d/gu)?.length ?? 0) < 5)) throw new BusinessError('Телефон — цифры, пробелы, скобки и дефис, например +7 495 123-45-67.');
  const address = field(form, 'address').replace(/\s+/gu, ' ');
  if (address.length > 200) throw new BusinessError('Адрес — до 200 символов.');
  return { bio: bio || null, story: story || null, publicEmail: publicEmail || null, phone: phone || null, address: address || null };
}

/** A phone as a `tel:` link: only the plus and the digits. */
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/gu, '')}`;
