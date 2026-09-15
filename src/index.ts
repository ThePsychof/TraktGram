import { createBot } from './bot';
import type { Update } from 'grammy/types';
import { TraktService } from './services/trakt';
import { OAuthService } from './services/oauth';
import { StorageService } from './services/storage';
import { handleMiniAppApiRequest } from './miniapp/api';
import { renderMiniAppPage } from './miniapp/ui';
import { getSuccessPageHTML, getErrorPageHTML } from './utils/oauth-pages';
import logger from './utils/logger';

interface Env {
  BOT_TOKEN: string;
  TRAKT_CLIENT_ID?: string;
  TRAKT_CLIENT_SECRET?: string;
  TRAKT_API_KEY?: string;
  WEBHOOK_SECRET?: string;
  OAUTH_REDIRECT_URI?: string;
  MINI_APP_URL?: string;
  ADMIN_SECRET?: string;
  STORE?: KVNamespace;
}

type BotInstance = Awaited<ReturnType<typeof createBot>>;

let bot: BotInstance | null = null;
let botToken: string | undefined;

function baseUrl(request: Request): string {
  const url = new URL(request.url);
  const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  return `${isLocal ? 'http' : 'https'}://${url.host}`;
}

function getTraktApiKey(env: Env): string | null {
  return env.TRAKT_CLIENT_ID ?? env.TRAKT_API_KEY ?? null;
}

function createTraktService(env: Env): TraktService | null {
  const key = getTraktApiKey(env);
  if (!key) {
    logger.warn('Trakt API key not configured; bot will run with limited functionality');
    return null;
  }
  return new TraktService(key);
}

function createOAuthService(env: Env, request: Request): OAuthService | null {
  if (!env.TRAKT_CLIENT_ID || !env.TRAKT_CLIENT_SECRET || !env.STORE) {
    return null;
  }
  const storage = new StorageService(env.STORE);
  const redirectUri = env.OAUTH_REDIRECT_URI || `${baseUrl(request)}/auth/callback`;
  return new OAuthService(env.TRAKT_CLIENT_ID, env.TRAKT_CLIENT_SECRET, redirectUri, storage);
}

function getMiniAppUrl(env: Env, request: Request): string {
  return env.MINI_APP_URL ?? `${baseUrl(request)}/miniapp`;
}

async function handleOAuthCallback(request: Request, env: Env): Promise<Response> {
  const html = (body: string, status: number) =>
    new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });

  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');

    logger.info('OAuth callback received', { hasCode: !!code, hasState: !!state, error });

    if (error) {
      return html(getErrorPageHTML(`${error}: ${errorDescription || 'Unknown error'}`), 400);
    }
    if (!code || !state) {
      return html(getErrorPageHTML('Missing authorization code or state parameter'), 400);
    }

    const oauth = createOAuthService(env, request);
    if (!oauth) {
      logger.error('OAuth not configured');
      return html(getErrorPageHTML('OAuth is not configured on this server'), 500);
    }

    const oauthData = await oauth.handleCallback({ code, state });
    logger.info('OAuth callback processed successfully', {
      telegramId: oauthData.telegramId,
      username: oauthData.username,
    });
    return html(getSuccessPageHTML(oauthData.username || 'User'), 200);
  } catch (error) {
    logger.error('Error processing OAuth callback', error);
    return html(getErrorPageHTML('An error occurred during login. Please try again.'), 500);
  }
}

async function ensureBot(env: Env, request: Request): Promise<BotInstance | null> {
  if (!env.BOT_TOKEN) return null;
  if (bot && botToken === env.BOT_TOKEN) return bot;

  const traktService = createTraktService(env);
  const oauthService = createOAuthService(env, request);
  const miniAppUrl = getMiniAppUrl(env, request);

  const newBot = await createBot(env.BOT_TOKEN, traktService as TraktService, oauthService ?? undefined, miniAppUrl);
  await newBot.init();
  bot = newBot;
  botToken = env.BOT_TOKEN;
  logger.info('Bot initialized');
  return bot;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // ---- Health check ----
    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response('ok');
    }

    // ---- Admin: set Telegram webhook ----
    if (url.pathname === '/admin/set-webhook' && request.method === 'POST') {
      if (!env.ADMIN_SECRET || request.headers.get('x-admin-secret') !== env.ADMIN_SECRET) {
        return new Response('Unauthorized', { status: 401 });
      }
      if (!env.BOT_TOKEN) {
        return new Response('BOT_TOKEN not set', { status: 500 });
      }
      const res = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: `${baseUrl(request)}/webhook`,
          secret_token: env.WEBHOOK_SECRET,
          allowed_updates: ['message', 'callback_query', 'inline_query'],
        }),
      });
      return new Response(await res.text(), {
        status: res.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ---- Admin: webhook info ----
    if (url.pathname === '/admin/webhook-info' && request.method === 'GET') {
      if (!env.ADMIN_SECRET || request.headers.get('x-admin-secret') !== env.ADMIN_SECRET) {
        return new Response('Unauthorized', { status: 401 });
      }
      if (!env.BOT_TOKEN) {
        return new Response('BOT_TOKEN not set', { status: 500 });
      }
      const res = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/getWebhookInfo`);
      return new Response(await res.text(), {
        status: res.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ---- Admin: delete webhook ----
    if (url.pathname === '/admin/delete-webhook' && request.method === 'POST') {
      if (!env.ADMIN_SECRET || request.headers.get('x-admin-secret') !== env.ADMIN_SECRET) {
        return new Response('Unauthorized', { status: 401 });
      }
      if (!env.BOT_TOKEN) {
        return new Response('BOT_TOKEN not set', { status: 500 });
      }
      const res = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/deleteWebhook`);
      return new Response(await res.text(), {
        status: res.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ---- OAuth callback ----
    if (url.pathname === '/auth/callback' && request.method === 'GET') {
      return handleOAuthCallback(request, env);
    }

    // ---- Mini App HTML ----
    if (url.pathname === '/miniapp' && request.method === 'GET') {
      const deepLink = url.searchParams.get('deepLink') ?? undefined;
      const html = renderMiniAppPage(deepLink);
      return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    // ---- Mini App API ----
    if (url.pathname.startsWith('/api/')) {
      const traktService = createTraktService(env);
      const oauthService = createOAuthService(env, request);
      const apiResponse = await handleMiniAppApiRequest(
        request,
        url,
        traktService as TraktService,
        oauthService ?? undefined,
      );
      return apiResponse ?? new Response('Not Found', { status: 404 });
    }

    // ---- Telegram webhook ----
    if (url.pathname !== '/webhook' || request.method !== 'POST') {
      return new Response('Not Found', { status: 404 });
    }

    if (env.WEBHOOK_SECRET) {
      const secret = request.headers.get('x-telegram-bot-api-secret-token');
      if (secret !== env.WEBHOOK_SECRET) {
        logger.warn('Invalid webhook secret');
        return new Response('Unauthorized', { status: 401 });
      }
    }

    const activeBot = await ensureBot(env, request);
    if (!activeBot) {
      logger.error('Bot not configured (missing BOT_TOKEN)');
      return new Response('Bot not configured', { status: 500 });
    }

    const update = (await request.json()) as Update;
    ctx.waitUntil(
      activeBot.handleUpdate(update).catch((err: unknown) => {
        logger.error('Error handling update:', err);
      }),
    );

    return new Response('OK', { status: 200 });
  },
} as ExportedHandler<Env>;