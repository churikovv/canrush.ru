// Registers the bot webhook, command list and chat menu button.
// Usage: npm -w apps/site run telegram:setup   (reads apps/site/.env.local)
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env.local'), quiet: true });

const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
const siteUrl = process.env.BETTER_AUTH_URL?.trim().replace(/\/$/u, '');
if (!token || !secret || !siteUrl) throw new Error('TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET and BETTER_AUTH_URL are required');
if (!siteUrl.startsWith('https://')) throw new Error('Telegram webhooks need a public HTTPS BETTER_AUTH_URL');
// Same base URL as the site: a reverse proxy abroad when api.telegram.org is unreachable.
const apiUrl = (process.env.TELEGRAM_API_URL?.trim() || 'https://api.telegram.org').replace(/\/+$/u, '');
if (!apiUrl.startsWith('https://')) throw new Error('TELEGRAM_API_URL must use https://');

async function call(method, body) {
  const response = await fetch(`${apiUrl}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!data.ok) throw new Error(`${method}: ${data.description}`);
  console.log(`${method}: ok`);
}

await call('setWebhook', {
  url: `${siteUrl}/api/telegram/webhook`,
  secret_token: secret,
  allowed_updates: ['message', 'callback_query', 'inline_query', 'my_chat_member'],
  drop_pending_updates: true,
});
await call('setMyCommands', {
  commands: [
    { command: 'start', description: 'Что умеет бот' },
    { command: 'settings', description: 'Какие уведомления присылать' },
    { command: 'city', description: 'Город для цен и акций' },
  ],
});
await call('setChatMenuButton', { menu_button: { type: 'web_app', text: 'CanRush', web_app: { url: siteUrl } } });
console.log('Inline search also needs /setinline for this bot in @BotFather.');
