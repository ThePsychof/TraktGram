import { api as telegramApi, fetch as platformFetch, EndpointError } from 'sdk';
import type { CallbackQuery, InlineQuery, Message, Update } from 'grammy/types';
import { createBot } from '../bot';
import { OAuthService } from '../services/oauth';
import { StorageService } from '../services/storage';
import { TraktService } from '../services/trakt';
import type { StoredOAuthData } from '../types/oauth';
import { handleMiniAppApiRequest } from '../miniapp/api';
import type { MiniAppApiInput } from '../miniapp/api';
import { DatabaseKeyValueStore } from './storage';

type AppConfig = {
  TRAKT_CLIENT_ID?: string;
  TRAKT_CLIENT_SECRET?: string;
  TRAKT_API_KEY?: string;
  OAUTH_REDIRECT_URI?: string;
};

type ServerlessContext = {
  update?: { update_id?: number };
  initData?: { user?: { id?: number } };
};

type TelegramUpdate =
  | { type: 'message'; payload: Message }
  | { type: 'callback_query'; payload: CallbackQuery }
  | { type: 'inline_query'; payload: InlineQuery };

type JsonObject = Record<string, unknown>;

const storage = new StorageService(new DatabaseKeyValueStore());

function encodeQuery(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAppConfig(value: unknown): value is AppConfig {
  if (!isObject(value)) return false;
  return ['TRAKT_CLIENT_ID', 'TRAKT_CLIENT_SECRET', 'TRAKT_API_KEY', 'OAUTH_REDIRECT_URI']
    .every((key) => value[key] === undefined || typeof value[key] === 'string');
}

async function loadConfig(): Promise<AppConfig> {
  const value = await storage.kv.get('config', 'json');
  if (value === null) return {};
  if (!isAppConfig(value)) throw new Error('Stored TraktGram configuration is invalid');
  return value;
}

function createServices(config: AppConfig) {
  const apiKey = config.TRAKT_CLIENT_ID ?? config.TRAKT_API_KEY;
  const traktService = apiKey ? new TraktService(apiKey) : null;
  const oauthService =
    config.TRAKT_CLIENT_ID && config.TRAKT_CLIENT_SECRET && config.OAUTH_REDIRECT_URI
      ? new OAuthService(
          config.TRAKT_CLIENT_ID,
          config.TRAKT_CLIENT_SECRET,
          config.OAUTH_REDIRECT_URI,
          storage,
        )
      : null;
  return { traktService, oauthService };
}

function getTelegramUserId(context: ServerlessContext): number {
  const userId = context.initData?.user?.id;
  if (!Number.isSafeInteger(userId) || !userId || userId < 1) {
    throw new EndpointError('Open TraktGram from your Telegram Mini App.');
  }
  return userId;
}

function getInputString(input: unknown, key: string): string | undefined {
  if (!isObject(input)) return undefined;
  const value = input[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export async function processTelegramUpdate(
  update: TelegramUpdate,
  context: ServerlessContext,
): Promise<void> {
  globalThis.fetch = platformFetch;

  const config = await loadConfig();
  const { traktService, oauthService } = createServices(config);
  const bot = await createBot('1:telegram-serverless', traktService, oauthService ?? undefined);

  bot.api.config.use(async (_previous, method, payload) => {
    const result = await telegramApi[method](payload);
    return { ok: true, result: result as never };
  });

  await bot.init();
  const base = { update_id: context.update?.update_id ?? 0 };
  const telegramUpdate: Update = update.type === 'message'
    ? { ...base, message: update.payload as NonNullable<Update['message']> }
    : update.type === 'callback_query'
      ? { ...base, callback_query: update.payload as NonNullable<Update['callback_query']> }
      : { ...base, inline_query: update.payload as NonNullable<Update['inline_query']> };
  await bot.handleUpdate(telegramUpdate);
}

export async function miniappApi(input: unknown, context: ServerlessContext): Promise<unknown> {
  globalThis.fetch = platformFetch;
  const config = await loadConfig();
  const { traktService, oauthService } = createServices(config);
  if (!traktService) throw new EndpointError('Trakt API credentials are not configured.');
  if (!isObject(input) || typeof input.path !== 'string') {
    throw new EndpointError('Invalid Mini App API request.');
  }

  const query = isObject(input.query)
    ? Object.fromEntries(
        Object.entries(input.query).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
      )
    : undefined;
  const request: MiniAppApiInput = {
    path: input.path,
    query,
    method: typeof input.method === 'string' ? input.method : undefined,
    telegramId: getTelegramUserId(context),
  };
  const response = await handleMiniAppApiRequest(request, traktService, oauthService ?? undefined);
  if (!response) throw new EndpointError('Mini App route not found.', { status: 404 });
  if (response.status >= 400) {
    const body = isObject(response.body) ? response.body : {};
    const message = typeof body.error === 'string' ? body.error : 'Mini App request failed.';
    throw new EndpointError(message, { status: response.status });
  }
  return response.body;
}

export async function oauthStart(_input: unknown, context: ServerlessContext): Promise<JsonObject> {
  globalThis.fetch = platformFetch;
  const telegramId = getTelegramUserId(context);
  const config = await loadConfig();
  const { oauthService } = createServices(config);
  if (!oauthService || !config.TRAKT_CLIENT_ID || !config.OAUTH_REDIRECT_URI) {
    throw new EndpointError('Trakt OAuth is not configured.');
  }

  const state = await oauthService.createOAuthState(telegramId);
  const baseParams = {
    response_type: 'code',
    client_id: config.TRAKT_CLIENT_ID,
    redirect_uri: config.OAUTH_REDIRECT_URI,
    state,
  };
  const traktParams = encodeQuery(baseParams);
  const switchParams = encodeQuery({ ...baseParams, prompt: 'login' });
  const user: StoredOAuthData | null = await storage.getOAuthData(telegramId);

  return {
    traktUrl: `https://auth.trakt.tv/oauth/authorize?${traktParams}`,
    switchUrl: `https://auth.trakt.tv/oauth/authorize?${switchParams}`,
    username: user?.username ?? null,
    avatarUrl: user?.avatarUrl ?? null,
  };
}

export async function oauthCallback(input: unknown, context: ServerlessContext): Promise<{ connected: true }> {
  globalThis.fetch = platformFetch;
  const telegramId = getTelegramUserId(context);
  const code = getInputString(input, 'code');
  const state = getInputString(input, 'state');
  if (!code || !state) throw new EndpointError('Trakt login failed or was cancelled.');

  const config = await loadConfig();
  const { oauthService } = createServices(config);
  if (!oauthService) throw new EndpointError('Trakt OAuth is not configured.');

  await oauthService.handleCallback({ code, state }, telegramId);
  try {
    await telegramApi.sendMessage({
      chat_id: telegramId,
      text: '✅ Your Trakt account is connected.\n\nUse /me to view your profile, or /trending to browse what\'s hot.',
    });
  } catch (error) {
    console.error('Failed to send Trakt connection confirmation', error);
  }
  return { connected: true };
}

export async function configureCredentials(input: unknown, context?: ServerlessContext): Promise<{ configured: true }> {
  if (context?.initData) {
    throw new EndpointError('Credentials can only be configured with the authenticated Serverless CLI.');
  }
  if (!isObject(input)) throw new Error('Configuration must be an object.');

  const clientId = getInputString(input, 'TRAKT_CLIENT_ID');
  const clientSecret = getInputString(input, 'TRAKT_CLIENT_SECRET');
  const apiKey = getInputString(input, 'TRAKT_API_KEY');
  const redirectUri = getInputString(input, 'OAUTH_REDIRECT_URI');
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('TRAKT_CLIENT_ID, TRAKT_CLIENT_SECRET, and OAUTH_REDIRECT_URI are required.');
  }

  if (!/^https:\/\/app\d+\.tgcloud\.ai\/$/.test(redirectUri)) {
    throw new Error('OAUTH_REDIRECT_URI must be the HTTPS root URL of this Telegram-hosted Mini App.');
  }

  const config: AppConfig = {
    TRAKT_CLIENT_ID: clientId,
    TRAKT_CLIENT_SECRET: clientSecret,
    TRAKT_API_KEY: apiKey || clientId,
    OAUTH_REDIRECT_URI: redirectUri,
  };
  await storage.kv.put('config', JSON.stringify(config));
  return { configured: true };
}
