import type { Bot } from 'grammy';
import type { OAuthService } from '../services/oauth';
import logger from '../utils/logger';

/**
 * Register `/me` command
 * Shows current user's authenticated Trakt account info
 */
export function registerMe(bot: Bot, oauthService: OAuthService) {
  bot.command('me', async (ctx) => {
    try {
      const telegramId = ctx.from?.id;
      if (!telegramId) {
        logger.warn('Me command called with no user ID');
        await ctx.reply('❌ Unable to identify your account. Please try again.');
        return;
      }

      logger.info('Me command called', { telegramId });

      // Get user's OAuth data
      const userData = await oauthService.getAuthenticatedUser(telegramId);

      if (!userData) {
        await ctx.reply('❌ No Trakt account connected.\n\nUse /login to connect your Trakt account.');
        logger.info('User not authenticated', { telegramId });
        return;
      }

      // Format the response
      const lines = [
        '👤 *Trakt Account Information*',
        '',
        `📛 Username: \`${userData.username || 'Unknown'}\``,
        `✅ Status: Connected`,
      ];

      if (userData.userId) {
        lines.push(`🔑 Trakt ID: \`${userData.userId}\``);
      }

      // Format connected time
      const connectedDate = new Date(userData.createdAt).toLocaleDateString();
      lines.push(`📅 Connected: ${connectedDate}`);

      // Add features available info
      lines.push('');
      lines.push('*Available features:*');
      lines.push('• Watchlist');
      lines.push('• History');
      lines.push('• Collection');
      lines.push('• Ratings');
      lines.push('• Progress tracking');
      lines.push('• Recommendations');

      await ctx.reply(lines.join('\n'), {
        parse_mode: 'Markdown',
      });

      logger.info('Me command response sent', { telegramId, username: userData.username });
    } catch (error) {
      logger.error('Error in me command', error);
      await ctx.reply('❌ An error occurred while fetching your account info.');
    }
  });
}
