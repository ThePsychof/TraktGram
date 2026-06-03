import { createBot } from './bot';
import type { Update } from '@grammyjs/types';
import { TraktService } from './services/trakt';
import { OAuthService } from './services/oauth';
import { StorageService } from './services/storage';
import { getSuccessPageHTML, getErrorPageHTML } from './utils/oauth-pages';
import logger from './utils/logger';

interface Env {
  BOT_TOKEN: string;
  TRAKT_CLIENT_ID: string;
  TRAKT_CLIENT_SECRET: string;
  TRAKT_API_KEY?: string; // fallback for legacy deployments
  WEBHOOK_SECRET?: string;
  OAUTH_REDIRECT_URI?: string; // Optional, defaults to https://<worker-domain>/auth/callback
  STORE?: KVNamespace; // Cloudflare KV namespace for storing OAuth data
}

let bot: (ReturnType<typeof createBot> extends Promise<infer B> ? B : never) | null = null;
let botToken: string | undefined;
let oauthService: OAuthService | null = null;

/**
 * Parse the request URL to get the hostname
 */
function getHostname(request: Request): string {
  const url = new URL(request.url);
  return url.hostname;
}

/**
 * Route handler for OAuth callback
 */
async function handleOAuthCallback(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');

    logger.info('OAuth callback received', { hasCode: !!code, hasState: !!state, error });

    // Handle OAuth error response
    if (error) {
      const errorMsg = `${error}: ${errorDescription || 'Unknown error'}`;
      logger.warn('OAuth error from Trakt', { error, errorDescription });
      return new Response(getErrorPageHTML(errorMsg), {
        status: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Validate required parameters
    if (!code || !state) {
      logger.warn('OAuth callback missing required parameters');
      return new Response(getErrorPageHTML('Missing authorization code or state parameter'), {
        status: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Initialize OAuth service if not already done
    if (!oauthService) {
      if (!env.STORE) {
        logger.error('KV namespace not configured');
        return new Response(getErrorPageHTML('Storage not configured on server'), {
          status: 500,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }

      const storageService = new StorageService(env.STORE);
      const redirectUri = env.OAUTH_REDIRECT_URI || `https://${getHostname(request)}/auth/callback`;

      oauthService = new OAuthService(
        env.TRAKT_CLIENT_ID,
        env.TRAKT_CLIENT_SECRET,
        redirectUri,
        storageService
      );
    }

    // Process the callback
    const oauthData = await oauthService.handleCallback({ code, state });

    logger.info('OAuth callback processed successfully', {
      telegramId: oauthData.telegramId,
      username: oauthData.username,
    });

    // Return success page
    return new Response(getSuccessPageHTML(oauthData.username || 'User'), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error) {
    logger.error('Error processing OAuth callback', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(getErrorPageHTML(errorMsg), {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Handle OAuth callback route
    if (url.pathname === '/auth/callback' && request.method === 'GET') {
      return handleOAuthCallback(request, env);
    }

    // Handle Telegram webhook (existing functionality)
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    if (!env.BOT_TOKEN) {
      logger.error('BOT_TOKEN not set in environment');
      return new Response('Internal Server Error', { status: 500 });
    }

    if (env.WEBHOOK_SECRET) {
      const secret = request.headers.get('x-telegram-bot-api-secret-token');
      if (secret !== env.WEBHOOK_SECRET) {
        logger.warn('Invalid webhook secret');
        return new Response('Unauthorized', { status: 401 });
      }
    }

    if (!bot || botToken !== env.BOT_TOKEN) {
      const hasClientId = Boolean(env.TRAKT_CLIENT_ID);
      const hasClientSecret = Boolean(env.TRAKT_CLIENT_SECRET);
      const hasLegacyKey = Boolean(env.TRAKT_API_KEY);
      const usedKeyName = hasClientId ? 'TRAKT_CLIENT_ID' : hasLegacyKey ? 'TRAKT_API_KEY' : 'none';

      logger.info('Trakt env variables:', {
        TRAKT_CLIENT_ID: hasClientId,
        TRAKT_CLIENT_SECRET: hasClientSecret,
        TRAKT_API_KEY: hasLegacyKey,
        using: usedKeyName,
      });

      const traktApiKey = env.TRAKT_CLIENT_ID ?? env.TRAKT_API_KEY;
      if (!traktApiKey) {
        logger.error('Trakt API key not configured. Set TRAKT_CLIENT_ID in Cloudflare secrets.');
        return new Response('Internal Server Error', { status: 500 });
      }

      const traktService = new TraktService(traktApiKey);

      // Initialize OAuth service if credentials are available
      if (!oauthService && env.TRAKT_CLIENT_ID && env.TRAKT_CLIENT_SECRET && env.STORE) {
        try {
          const storageService = new StorageService(env.STORE);
          const redirectUri = env.OAUTH_REDIRECT_URI || `https://${getHostname(request)}/auth/callback`;

          oauthService = new OAuthService(
            env.TRAKT_CLIENT_ID,
            env.TRAKT_CLIENT_SECRET,
            redirectUri,
            storageService
          );

          logger.info('OAuth service initialized');
        } catch (error) {
          logger.warn('Failed to initialize OAuth service', error);
        }
      }

      bot = await createBot(env.BOT_TOKEN, traktService, oauthService || undefined);
      botToken = env.BOT_TOKEN;
      await bot.init();
    }

    const update = await request.json() as Update;
    ctx.waitUntil(bot!.handleUpdate(update).catch((err: unknown) => {
      logger.error('Error handling update:', err);
    }));

    return new Response('OK', { status: 200 });
  }
} as ExportedHandler<Env>;
