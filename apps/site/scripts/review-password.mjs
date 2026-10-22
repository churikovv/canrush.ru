// Пароль и хэш для входа проверяющего магазина приложений (REVIEW_LOGIN_*, src/lib/review-login.ts).
// npm -w apps/site run review:password            — сгенерировать случайный пароль
// npm -w apps/site run review:password -- <пароль> — посчитать хэш для своего пароля
// Пароль отдаётся только проверяющему (Play Console → «Доступ к приложению»), в .env.local — только хэш.
import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';

const password = process.argv[2] ?? randomBytes(12).toString('base64url');
if (password.length < 12) {
  console.error('Пароль должен быть не короче 12 символов.');
  process.exit(1);
}
const salt = randomBytes(16);
const key = await promisify(scrypt)(password, salt, 32);
console.log(`Пароль для проверяющего: ${password}`);
console.log(`REVIEW_LOGIN_PASSWORD_HASH=scrypt:${salt.toString('base64url')}:${key.toString('base64url')}`);
