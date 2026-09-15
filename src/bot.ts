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

export async function createBot(
  token: string,
  traktService: TraktService | null,
  oauthService?: OAuthService,
  miniAppUrl?: string,
) {
  const bot = new Bot(token);

  // Always safe to register these — they don't need external services
  registerPing(bot);
  registerHelp(bot);

  // Only register handlers that need a Trakt service
  if (traktService) {
    registerStart(bot, traktService, oauthService, miniAppUrl);
    registerTrending(bot, traktService);
    registerInlineQuery(bot, traktService);
  } else {
    logger.warn('TraktService not configured — /start, /trending, and inline mode disabled');
  }

  // Only register handlers that need OAuth
  if (oauthService) {
    registerLogin(bot, oauthService);
    registerMe(bot, oauthService);
  } else {
    logger.warn('OAuthService not configured — /login and /me disabled');
  }

  // Callback handlers need Trakt at minimum
  if (traktService) {
    try {
      const { registerCallbackHandlers } = await import('./handlers/callbacks');
      registerCallbackHandlers(bot, traktService, oauthService, miniAppUrl);
    } catch (err) {
      logger.error('Failed to register callback handlers', err);
    }
  }

  bot.catch((err) => {
    logger.error('Unhandled bot error', err);
  });

  return bot;
}