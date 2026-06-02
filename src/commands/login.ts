import type { Bot } from 'grammy';
import { InlineKeyboard } from 'grammy';
import type { OAuthService } from '../services/oauth';
import logger from '../utils/logger';

/**
 * Register `/login` command
 * Initiates Trakt OAuth login flow
 */
export function registerLogin(bot: Bot, oauthService: OAuthService) {
  bot.command('login', async (ctx) => {
    try {
      const telegramId = ctx.from?.id;
      if (!telegramId) {
        logger.warn('Login command called with no user ID');
        await ctx.reply('❌ Unable to identify your account. Please try again.');
        return;
      }

      logger.info('Login command initiated', { telegramId });

      // Generate OAuth authorization URL
      const authUrl = await oauthService.generateAuthorizationUrl(telegramId);

      // Create inline keyboard with login button
      const keyboard = new InlineKeyboard().webApp('Login with Trakt', authUrl);

      await ctx.reply('🔐 Connect your Trakt account\n\nClick the button below to authorize TraktGram to access your Trakt data.', {
        reply_markup: keyboard,
      });

      logger.info('Login button sent to user', { telegramId });
    } catch (error) {
      logger.error('Error in login command', error);
      await ctx.reply('❌ An error occurred. Please try again later.');
    }
  });
}
