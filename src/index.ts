import { createBot } from './bot';
import type { Update } from '@grammyjs/types';
import { TraktService } from './services/trakt';
import logger from './utils/logger';

interface CloudflareEnv {
  BOT_TOKEN: string;
  TRAKT_CLIENT_ID: string;
  TRAKT_CLIENT_SECRET?: string;
  WEBHOOK_SECRET?: string;
}

let bot = null as ReturnType<typeof createBot> | null;
let botToken: string | undefined;

export default {
  async fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response> {
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
      const traktService = new TraktService(env.TRAKT_CLIENT_ID);
      bot = createBot(env.BOT_TOKEN, traktService);
      botToken = env.BOT_TOKEN;
      await bot.init();
    }

    const update = await request.json() as Update;
    ctx.waitUntil(bot.handleUpdate(update).catch((err) => {
      logger.error('Error handling update:', err);
    }));

    return new Response('OK', { status: 200 });
  }
} as ExportedHandler<CloudflareEnv>;
