import { Bot } from 'grammy';
import { registerStart } from './commands/start';
import { registerPing } from './commands/ping';
import { registerHelp } from './commands/help';
import { registerTrending } from './commands/trending';
import { registerInlineQuery } from './handlers/inline';
import type { TraktService } from './services/trakt';
import logger from './utils/logger';

export function createBot(token: string, traktService: TraktService) {
  const bot = new Bot(token);

  registerStart(bot);
  registerPing(bot);
  registerHelp(bot);
  registerTrending(bot, traktService);
  registerInlineQuery(bot, traktService);

  bot.catch((err) => {
    logger.error('Unhandled bot error', err);
  });

  return bot;
}
