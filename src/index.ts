import { createBot } from './bot';
import type { Update } from 'grammy/types';
import { TraktService } from './services/trakt';
import { OAuthService } from './services/oauth';
import { StorageService } from './services/storage';
import logger from './utils/logger';
import { renderAuthStartPage } from './miniapp/auth-page';
import { renderMiniAppPage } from './miniapp/ui';
import { handleMiniAppApiRequest } from './miniapp/api';

interface Env {
  BOT_TOKEN: string;
  TRAKT_CLIENT_ID?: string;
  TRAKT_CLIENT_SECRET?: string;
  TRAKT_API_KEY?: string;
  WEBHOOK_SECRET?: string;
  OAUTH_REDIRECT_URI?: string;
  ADMIN_SECRET?: string;
  STORE?: KVNamespace;
}

const BOT_USERNAME = 'TraktGram_bot';

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

async function handleOAuthCallback(request: Request, env: Env): Promise<Response> {
  const redirectTo = (payload: string) =>
    new Response(null, {
      status: 302,
      headers: { Location: `https://t.me/${BOT_USERNAME}?start=${payload}` },
    });

  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    logger.info('OAuth callback received', { hasCode: !!code, hasState: !!state, error });

    if (error) return redirectTo('connect_failed');
    if (!code || !state) return redirectTo('connect_failed');

    const oauth = createOAuthService(env, request);
    if (!oauth) {
      logger.error('OAuth not configured');
      return redirectTo('connect_failed');
    }

    const oauthData = await oauth.handleCallback({ code, state });
    logger.info('OAuth callback processed successfully', {
      telegramId: oauthData.telegramId,
      username: oauthData.username,
    });
    return redirectTo('connected');
  } catch (error) {
    logger.error('Error processing OAuth callback', error);
    return redirectTo('connect_failed');
  }
}

async function ensureBot(env: Env, request: Request): Promise<BotInstance | null> {
  if (!env.BOT_TOKEN) return null;
  if (bot && botToken === env.BOT_TOKEN) return bot;

  const traktService = createTraktService(env);
  const oauthService = createOAuthService(env, request);

  const newBot = await createBot(
    env.BOT_TOKEN,
    traktService as TraktService,
    oauthService ?? undefined,
  );
  await newBot.init();
  bot = newBot;
  botToken = env.BOT_TOKEN;
  logger.info('Bot initialized');
  return bot;
}

async function handleAuthStart(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const state = url.searchParams.get('state');

  if (!state || !env.TRAKT_CLIENT_ID) {
    return new Response('Missing state or Trakt client ID', { status: 400 });
  }

  const telegramId = Number(state.split('_')[0]);
  let currentUsername: string | undefined;
  let currentAvatarUrl: string | undefined;

  if (telegramId && env.STORE) {
    try {
      const storage = new StorageService(env.STORE);
      const data = await storage.getOAuthData(telegramId);
      if (data) {
        currentUsername = data.username ?? undefined;
        currentAvatarUrl = (data as any).avatarUrl ?? undefined;
      }
    } catch {
      // ignore
    }
  }

  const redirectUri = env.OAUTH_REDIRECT_URI || `${baseUrl(request)}/auth/callback`;

  // Primary authorize URL — uses existing Trakt session if available.
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: env.TRAKT_CLIENT_ID,
    redirect_uri: redirectUri,
    state,
  });
  const traktUrl = `https://auth.trakt.tv/oauth/authorize?${params.toString()}`;

  // Secondary authorize URL — forces Trakt to ask for login again.
  const switchParams = new URLSearchParams({
    response_type: 'code',
    client_id: env.TRAKT_CLIENT_ID,
    redirect_uri: redirectUri,
    state,
    prompt: 'login',
  });
  const switchUrl = `https://auth.trakt.tv/oauth/authorize?${switchParams.toString()}`;

  const html = renderAuthStartPage({
    traktUrl,
    switchUrl,
    currentUsername,
    currentAvatarUrl,
  });

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response('ok');
    }

    if (url.pathname === '/admin/set-webhook' && request.method === 'POST') {
      if (!env.ADMIN_SECRET || request.headers.get('x-admin-secret') !== env.ADMIN_SECRET) {
        return new Response('Unauthorized', { status: 401 });
      }
      if (!env.BOT_TOKEN) return new Response('BOT_TOKEN not set', { status: 500 });
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

    if (url.pathname === '/admin/webhook-info' && request.method === 'GET') {
      if (!env.ADMIN_SECRET || request.headers.get('x-admin-secret') !== env.ADMIN_SECRET) {
        return new Response('Unauthorized', { status: 401 });
      }
      if (!env.BOT_TOKEN) return new Response('BOT_TOKEN not set', { status: 500 });
      const res = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/getWebhookInfo`);
      return new Response(await res.text(), {
        status: res.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url.pathname === '/admin/delete-webhook' && request.method === 'POST') {
      if (!env.ADMIN_SECRET || request.headers.get('x-admin-secret') !== env.ADMIN_SECRET) {
        return new Response('Unauthorized', { status: 401 });
      }
      if (!env.BOT_TOKEN) return new Response('BOT_TOKEN not set', { status: 500 });
      const res = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/deleteWebhook`);
      return new Response(await res.text(), {
        status: res.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url.pathname === '/api/img' && request.method === 'GET') {
      const target = url.searchParams.get('u');
      if (!target) return new Response('Missing u', { status: 400 });

      // Only allow Trakt media hosts
      let parsed: URL;
      try {
        parsed = new URL(target);
      } catch {
        return new Response('Invalid url', { status: 400 });
      }
      const allowedHosts = ['media.trakt.tv', 'walter.trakt.tv', 'secure.gravatar.com'];
      if (!allowedHosts.includes(parsed.hostname)) {
        return new Response('Host not allowed', { status: 403 });
      }

      const imgRes = await fetch(parsed.toString(), {
        headers: { 'User-Agent': 'TraktGram/1.0' },
      });
      if (!imgRes.ok) {
        return new Response('Upstream error', { status: 502 });
      }

      const contentType = imgRes.headers.get('content-type') ?? 'image/jpeg';
      const body = await imgRes.arrayBuffer();
      return new Response(body, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }


    if (url.pathname === '/auth/start' && request.method === 'GET') {
      return handleAuthStart(request, env);
    }

    if (url.pathname === '/miniapp' && request.method === 'GET') {
      const deepLink = url.searchParams.get('deepLink') ?? undefined;
      const html = renderMiniAppPage(deepLink);
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      });
    }


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

    if (url.pathname === '/auth/callback' && request.method === 'GET') {
      return handleOAuthCallback(request, env);
    }

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