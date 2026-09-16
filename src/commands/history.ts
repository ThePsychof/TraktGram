import type { Bot } from 'grammy';
import type { TraktService } from '../services/trakt';
import type { OAuthService } from '../services/oauth';
import { renderHistory } from '../ui/screens/history';
import logger from '../utils/logger';

export function registerHistory(bot: Bot, traktService: TraktService, oauthService: OAuthService) {
  bot.command('history', async (ctx) => {
    try {
      await renderHistory(ctx, traktService, oauthService, 1, '');
    } catch (err) {
      logger.error('Error in /history command', err);
      await ctx.reply('❌ Failed to load history.');
    }
  });
}