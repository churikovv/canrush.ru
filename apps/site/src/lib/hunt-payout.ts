import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import type { HuntPayout } from '@/lib/hunt-fields';

const VERSION = 'v1';

/** Ключ выводится из секрета сайта: он лежит в окружении, а не в базе, поэтому копии базы реквизитов не раскрывают. */
function key() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error('BETTER_AUTH_SECRET is required for payout details');
  return Buffer.from(hkdfSync('sha256', secret, 'canrush-hunt-payout', '', 32));
}

/** Реквизиты для базы: AES-256-GCM, случайный вектор на каждую заявку. */
export function sealPayout(payout: HuntPayout) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(payout), 'utf8'), cipher.final()]);
  return [VERSION, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join('.');
}

/** Открытый текст для админки; `null`, если секрет сменился или запись повреждена. */
export function openPayout(sealed: string): HuntPayout | null {
  const [version, iv, tag, data] = sealed.split('.');
  if (version !== VERSION || !iv || !tag || !data) return null;
  try {
    const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8')) as HuntPayout;
  } catch {
    return null;
  }
}
