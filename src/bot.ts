import { Bot } from 'grammy';
import { registerStart } from './commands/start';
import { registerPing } from './commands/ping';
import { registerHelp } from './commands/help';
import { registerTrending } from './commands/trending';
import { registerLogin } from './commands/login';
import { registerMe } from './commands/me';
import { registerInlineQuery } from './handlers/inline';
import type { TraktService } from './services/trakt';
import type { OAuthService } from './services/oauth';
import logger from './utils/logger';

export function createBot(token: string, traktService: TraktService, oauthService?: OAuthService) {
  const bot = new Bot(token);

  registerStart(bot);
  registerPing(bot);
  registerHelp(bot);
  registerTrending(bot, traktService);
  registerInlineQuery(bot, traktService);

  // Register OAuth-based commands if OAuthService is available
  if (oauthService) {
    registerLogin(bot, oauthService);
    registerMe(bot, oauthService);
  }

  bot.catch((err) => {
    logger.error('Unhandled bot error', err);
  });

  return bot;
}
