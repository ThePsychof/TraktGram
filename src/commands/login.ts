import type { Bot } from 'grammy';
import { InlineKeyboard } from 'grammy';
import type { OAuthService } from '../services/oauth';
import logger from '../utils/logger';

export function registerLogin(bot: Bot, oauthService: OAuthService) {
  bot.command('login', async (ctx) => {
    try {
      const telegramId = ctx.from?.id;
      if (!telegramId) {
        await ctx.reply('❌ Unable to identify your account.');
        return;
      }

      const state = await oauthService.createOAuthState(telegramId);
      const base = oauthService.getBaseUrl();
      const pageUrl = `${base}/auth/start?state=${encodeURIComponent(state)}`;

      const keyboard = new InlineKeyboard().url('🔐 Connect Trakt', pageUrl);

      await ctx.reply(
        '🔐 Connect your Trakt account\n\nTap the button below to choose how you want to sign in.',
        { reply_markup: keyboard },
      );
    } catch (error) {
      logger.error('Error in login command', error);
      await ctx.reply('❌ An error occurred. Please try again later.');
    }
  });
}