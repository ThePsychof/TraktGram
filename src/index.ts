import { createBot } from './bot';
import type { Update } from '@grammyjs/types';
import { TraktService } from './services/trakt';
import { TmdbService } from './services/tmdb';
import logger from './utils/logger';

interface Env {
  BOT_TOKEN: string;
  TRAKT_CLIENT_ID: string;
  TRAKT_CLIENT_SECRET: string;
  TRAKT_API_KEY?: string; // fallback for legacy deployments
  TMDB_API_KEY?: string;
  WEBHOOK_SECRET?: string;
}

let bot = null as ReturnType<typeof createBot> | null;
let botToken: string | undefined;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
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
      const tmdbService = new TmdbService(env.TMDB_API_KEY);
      bot = createBot(env.BOT_TOKEN, traktService, tmdbService);
      botToken = env.BOT_TOKEN;
      await bot.init();
    }

    const update = await request.json() as Update;
    ctx.waitUntil(bot.handleUpdate(update).catch((err) => {
      logger.error('Error handling update:', err);
    }));

    return new Response('OK', { status: 200 });
  }
} as ExportedHandler<Env>;
