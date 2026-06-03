import { Bot } from 'grammy';
import { registerStart } from './commands/start';
import { registerPing } from './commands/ping';
import { registerHelp } from './commands/help';
import { registerTrending } from './commands/trending';
import { registerLogin } from './commands/login';
import { registerMe } from './commands/me';
import { registerSearch } from './commands/search';
import { registerInlineQuery } from './handlers/inline';
import type { TraktService } from './services/trakt';
import type { OAuthService } from './services/oauth';
import logger from './utils/logger';

export function createBot(token: string, traktService: TraktService, oauthService?: OAuthService) {
  const bot = new Bot(token);

  registerStart(bot, oauthService);
  registerPing(bot);
  registerHelp(bot);
  registerTrending(bot, traktService);
  registerSearch(bot, traktService);
  registerInlineQuery(bot, traktService);

  // Register OAuth-based commands if OAuthService is available
  if (oauthService) {
    registerLogin(bot, oauthService);
    registerMe(bot, oauthService);
  }

  // Register new callback handlers for navigation and UI
  try {
    // Dynamically import to avoid circulars in some setups
    const { registerCallbackHandlers } = require('./handlers/callbacks') as typeof import('./handlers/callbacks');
    registerCallbackHandlers(bot, traktService, oauthService);
  } catch (err) {
    logger.error('Failed to register callback handlers', err);
  }

  bot.catch((err) => {
    logger.error('Unhandled bot error', err);
  });

  return bot;
}
