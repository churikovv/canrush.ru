import { createHash } from 'node:crypto';
import { CITIES, DEFAULT_CITY, findCity, type CityId } from '@canrush/shared';
import type { Pool } from 'pg';
import { callTelegram, type InlineKeyboard } from './api';
import { searchProducts } from './catalog';
import { askLoginConfirmation, decideLogin } from './login';
import { TELEGRAM_BOT_OPTIONS, type TelegramBotColumn } from './settings';
import { escapeHtml, openButton, productCard, productName, productSummary, productUrl, truncate } from './format';

export interface BotContext {
  pool: Pool;
  token: string;
  siteUrl: string;
  botUsername: string;
}

interface TelegramUserRef { id: number; first_name?: string; last_name?: string; username?: string }
interface Chat { id: number; type: string }
interface Message { message_id: number; chat: Chat; from?: TelegramUserRef; text?: string }
interface CallbackQuery { id: string; from: TelegramUserRef; data?: string; message?: Message }
interface InlineQuery { id: string; from: TelegramUserRef; query: string }
interface ChatMemberUpdated { chat: Chat; from: TelegramUserRef; new_chat_member: { status: string } }
export interface TelegramUpdate {
  update_id: number;
  message?: Message;
  callback_query?: CallbackQuery;
  inline_query?: InlineQuery;
  my_chat_member?: ChatMemberUpdated;
}

const SEARCH_LIMIT = 5;
const INLINE_LIMIT = 10;

const TOGGLES = Object.fromEntries(TELEGRAM_BOT_OPTIONS.map(option => [option.code, option])) as Record<ToggleCode, (typeof TELEGRAM_BOT_OPTIONS)[number]>;
type ToggleCode = (typeof TELEGRAM_BOT_OPTIONS)[number]['code'];
type ChatSettings = Record<TelegramBotColumn, boolean> & { city: string | null };

interface ChatState { settings: ChatSettings | null; linked: boolean; admin: boolean }

async function chatState(pool: Pool, telegramId: number): Promise<ChatState> {
  const { rows } = await pool.query<ChatSettings & { linked: boolean; admin: boolean; started: boolean }>(`
    select c.city, c.notify, c.market, c."promoAlerts", c."weeklyDigest", c."adminSummary", c."telegramId" is not null as started,
      a."userId" is not null as linked,
      exists (select 1 from "user" u join "siteAdmin" s on s.email = lower(u.email) and s.role = 'admin' where u.id = a."userId") as admin
    from (select $1::bigint as id) t
    left join "telegramChat" c on c."telegramId" = t.id
    left join account a on a."providerId" = 'telegram' and a."accountId" = t.id::text`, [telegramId]);
  const row = rows[0];
  return { settings: row?.started ? row : null, linked: row?.linked ?? false, admin: row?.admin ?? false };
}

function cityName(id: string | null | undefined): string {
  return (findCity(id) ?? DEFAULT_CITY).name;
}

function cityKeyboard(): InlineKeyboard {
  const rows: InlineKeyboard = [];
  for (let index = 0; index < CITIES.length; index += 2) {
    rows.push(CITIES.slice(index, index + 2).map(city => ({ text: city.name, callback_data: `c:${city.id}` })));
  }
  return rows;
}

function settingsKeyboard(state: ChatState): InlineKeyboard {
  const settings = state.settings;
  if (!settings) return [];
  const codes = TELEGRAM_BOT_OPTIONS.filter(option => !option.adminOnly || state.admin).map(option => option.code);
  return [
    ...codes.map(code => [{ text: `${settings[TOGGLES[code].column] ? '✅' : '⬜'} ${TOGGLES[code].label}`, callback_data: `t:${code}` }]),
    [{ text: `📍 Город: ${cityName(settings.city)}`, callback_data: 'city' }],
  ];
}

function settingsText(state: ChatState): string {
  const lines = ['<b>Настройки бота</b>', 'Нажмите на пункт, чтобы включить или выключить его.'];
  if (!state.linked) lines.push('', 'Уведомления и акции на избранное придут после входа в CanRush через мини-приложение.');
  return lines.join('\n');
}

function welcomeText(ctx: BotContext, state: ChatState): string {
  const lines = [
    '<b>Привет! Это бот CanRush ⚡</b>',
    '',
    '• Напишите название энергетика — покажу, где он дешевле в вашем городе, и его рейтинг.',
    `• В любом чате наберите <code>@${escapeHtml(ctx.botUsername)} burn</code> и отправьте карточку другу.`,
    '• Пришлю уведомления сайта, сообщения маркета и акции на ваше избранное.',
    '',
    `Город: ${escapeHtml(cityName(state.settings?.city))} — /city. Что присылать — /settings.`,
  ];
  if (!state.linked) lines.push('', 'Чтобы получать уведомления, войдите в CanRush кнопкой ниже.');
  return lines.join('\n');
}

async function send(ctx: BotContext, chatId: number, text: string, keyboard?: InlineKeyboard): Promise<void> {
  await callTelegram(ctx.token, 'sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    ...(keyboard?.length ? { reply_markup: { inline_keyboard: keyboard } } : {}),
  });
}

async function startChat(ctx: BotContext, telegramId: number, chatId: number): Promise<void> {
  await ctx.pool.query(`
    insert into "telegramChat" ("telegramId", "chatId") values ($1, $2)
    on conflict ("telegramId") do update set "chatId" = excluded."chatId", "blockedAt" = null`, [telegramId, chatId]);
}

async function handleMessage(ctx: BotContext, message: Message): Promise<void> {
  if (message.chat.type !== 'private' || !message.from || !message.text) return;
  const text = message.text.trim();
  const command = /^\/([a-z]+)(?:@\w+)?(?:\s|$)/u.exec(text)?.[1];
  const chatId = message.chat.id;

  if (command === 'start') {
    await startChat(ctx, message.from.id, chatId);
    const payload = text.split(/\s+/u)[1] ?? '';
    if (payload.startsWith('login_') && await askLoginConfirmation(ctx.pool, payload.slice('login_'.length), (body, keyboard) => send(ctx, chatId, body, keyboard))) return;
    const state = await chatState(ctx.pool, message.from.id);
    await send(ctx, chatId, welcomeText(ctx, state), state.linked ? [] : [[openButton('Открыть CanRush', ctx.siteUrl)]]);
    if (!state.settings?.city) await send(ctx, chatId, 'Выберите город, чтобы цены и акции были местными:', cityKeyboard());
    return;
  }
  if (command === 'settings') {
    await startChat(ctx, message.from.id, chatId);
    const state = await chatState(ctx.pool, message.from.id);
    await send(ctx, chatId, settingsText(state), settingsKeyboard(state));
    return;
  }
  if (command === 'city') {
    await startChat(ctx, message.from.id, chatId);
    await send(ctx, chatId, 'Выберите город:', cityKeyboard());
    return;
  }
  if (command) {
    const state = await chatState(ctx.pool, message.from.id);
    await send(ctx, chatId, welcomeText(ctx, state));
    return;
  }

  const query = truncate(text, 80);
  const state = await chatState(ctx.pool, message.from.id);
  const city = (findCity(state.settings?.city) ?? DEFAULT_CITY).id as CityId;
  const products = await searchProducts(city, query, SEARCH_LIMIT);
  if (!products.length) {
    await send(ctx, chatId, `Ничего не нашёл по «${escapeHtml(query)}». Попробуйте бренд или вкус, например «Burn манго».`);
    return;
  }
  await send(
    ctx,
    chatId,
    `${products.map(productCard).join('\n\n')}\n\n<i>Цены: ${escapeHtml(cityName(city))}</i>`,
    products.map(product => [openButton(truncate(productName(product.brand, product.flavor), 40), productUrl(ctx.siteUrl, product.brand, product.flavor))]),
  );
}

async function handleCallback(ctx: BotContext, query: CallbackQuery): Promise<void> {
  const data = query.data ?? '';
  const message = query.message;
  let notice: string | undefined;
  if (message && data.startsWith('lg:')) {
    notice = (await decideLogin(ctx.pool, ctx.token, query.from, data, message.chat.id, message.message_id)) ?? undefined;
  } else if (message && data.startsWith('t:')) {
    const code = data.slice(2);
    const toggle = Object.hasOwn(TOGGLES, code) ? TOGGLES[code as ToggleCode] : undefined;
    if (toggle) {
      // The column name comes from the fixed TOGGLES map, never from user input.
      await ctx.pool.query(`update "telegramChat" set "${toggle.column}" = not "${toggle.column}" where "telegramId" = $1`, [query.from.id]);
      const state = await chatState(ctx.pool, query.from.id);
      await callTelegram(ctx.token, 'editMessageReplyMarkup', { chat_id: message.chat.id, message_id: message.message_id, reply_markup: { inline_keyboard: settingsKeyboard(state) } });
    }
  } else if (message && data === 'city') {
    await callTelegram(ctx.token, 'editMessageReplyMarkup', { chat_id: message.chat.id, message_id: message.message_id, reply_markup: { inline_keyboard: cityKeyboard() } });
  } else if (message && data.startsWith('c:')) {
    const city = findCity(data.slice(2));
    if (city) {
      await startChat(ctx, query.from.id, message.chat.id);
      await ctx.pool.query('update "telegramChat" set city = $2 where "telegramId" = $1', [query.from.id, city.id]);
      await callTelegram(ctx.token, 'editMessageText', {
        chat_id: message.chat.id,
        message_id: message.message_id,
        text: `📍 Город: <b>${escapeHtml(city.name)}</b>. Теперь цены и акции — для этого города.`,
        parse_mode: 'HTML',
      });
      notice = city.name;
    }
  }
  await callTelegram(ctx.token, 'answerCallbackQuery', { callback_query_id: query.id, ...(notice ? { text: notice } : {}) });
}

function absoluteImage(siteUrl: string, src: string | undefined): string | undefined {
  if (!src) return undefined;
  if (src.startsWith('/')) return siteUrl.startsWith('https://') ? `${siteUrl}${src}` : undefined;
  return src.startsWith('https://') ? src : undefined;
}

async function handleInlineQuery(ctx: BotContext, query: InlineQuery): Promise<void> {
  const text = truncate(query.query, 80);
  const state = await chatState(ctx.pool, query.from.id);
  const city = (findCity(state.settings?.city) ?? DEFAULT_CITY).id as CityId;
  const products = text ? await searchProducts(city, text, INLINE_LIMIT) : [];
  const results = products.map(product => {
    const url = productUrl(ctx.siteUrl, product.brand, product.flavor);
    const thumbnail = absoluteImage(ctx.siteUrl, product.coverImageUrl);
    return {
      type: 'article',
      id: createHash('sha256').update(url).digest('hex').slice(0, 32),
      title: productName(product.brand, product.flavor),
      description: productSummary(product),
      ...(thumbnail ? { thumbnail_url: thumbnail } : {}),
      input_message_content: {
        message_text: `${productCard(product)}\n<i>${escapeHtml(cityName(city))}</i>`,
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      },
      reply_markup: { inline_keyboard: [[{ text: 'Цены и отзывы на CanRush', url }]] },
    };
  });
  await callTelegram(ctx.token, 'answerInlineQuery', {
    inline_query_id: query.id,
    results,
    cache_time: 300,
    is_personal: true,
    ...(ctx.siteUrl.startsWith('https://') ? { button: { text: 'Открыть CanRush', web_app: { url: ctx.siteUrl } } } : {}),
  });
}

async function handleMembership(ctx: BotContext, update: ChatMemberUpdated): Promise<void> {
  if (update.chat.type !== 'private') return;
  if (update.new_chat_member.status === 'kicked') {
    await ctx.pool.query('update "telegramChat" set "blockedAt" = now() where "telegramId" = $1', [update.from.id]);
  } else if (update.new_chat_member.status === 'member') {
    await startChat(ctx, update.from.id, update.chat.id);
  }
}

export async function handleTelegramUpdate(ctx: BotContext, update: TelegramUpdate): Promise<void> {
  if (update.message) await handleMessage(ctx, update.message);
  else if (update.callback_query) await handleCallback(ctx, update.callback_query);
  else if (update.inline_query) await handleInlineQuery(ctx, update.inline_query);
  else if (update.my_chat_member) await handleMembership(ctx, update.my_chat_member);
}
