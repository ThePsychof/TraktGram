import type { Bot } from 'grammy';
import type { OAuthService } from '../services/oauth';
import type { TraktService } from '../services/trakt';
import { formatWatchTime } from '../utils/format';
import logger from '../utils/logger';

export function registerMe(bot: Bot, oauthService: OAuthService, traktService?: TraktService) {
  bot.command('me', async (ctx) => {
    try {
      const telegramId = ctx.from?.id;
      if (!telegramId) {
        await ctx.reply('❌ Unable to identify your account.');
        return;
      }

      const userData = await oauthService.getAuthenticatedUser(telegramId);
      if (!userData) {
        await ctx.reply('❌ No Trakt account connected.\n\nUse /login to connect.');
        return;
      }

      const lines = [
        '👤 *Trakt Account Information*',
        '',
        `📛 Username: \`${userData.username || 'Unknown'}\``,
        `✅ Status: Connected`,
      ];

      if (userData.userId) {
        lines.push(`🔑 Trakt ID: \`${userData.userId}\``);
      }

      const connectedDate = new Date(userData.createdAt).toLocaleDateString();
      lines.push(`📅 Connected: ${connectedDate}`);

      if (traktService) {
        const accessToken = await oauthService.getValidAccessToken(telegramId);
        if (accessToken) {
          try {
            const s = await traktService.getUserStats(accessToken);

            if (s.available) {
              lines.push('');
              lines.push('📊 *Stats*');
              lines.push(`🎬 Movies watched: *${s.moviesWatched}*`);
              lines.push(`📺 Episodes watched: *${s.episodesWatched}*`);
              lines.push(`⭐ Ratings given: *${s.ratingsGiven}*`);
              lines.push('');
              lines.push('⏱ *Total time watched*');
              lines.push(`🎬 Movies: *${formatWatchTime(s.movieMinutes)}*`);
              lines.push(`📺 Episodes: *${formatWatchTime(s.episodeMinutes)}*`);
              lines.push(`📊 Total: *${formatWatchTime(s.totalMinutes)}*`);
            } else {
              lines.push('');
              lines.push('⚠️ _Trakt stats unavailable right now (known Trakt-side issue)._');
            }
          } catch (err) {
            logger.warn('Failed to fetch stats for /me', err);
          }
        }
      }

      lines.push('');
      lines.push('Use /stats for detailed numbers.');

      await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
    } catch (error) {
      logger.error('Error in me command', error);
      await ctx.reply('❌ An error occurred while fetching your account info.');
    }
  });
}