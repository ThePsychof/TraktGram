import type { Bot } from 'grammy';
import type { OAuthService } from '../services/oauth';
import type { TraktService } from '../services/trakt';
import { formatWatchTime } from '../utils/format';
import logger from '../utils/logger';

export function registerStats(bot: Bot, traktService: TraktService, oauthService: OAuthService) {
  bot.command('stats', async (ctx) => {
    if (!ctx.from) {
      await ctx.reply('❌ Unable to identify your account.');
      return;
    }

    const accessToken = await oauthService.getValidAccessToken(ctx.from.id);
    if (!accessToken) {
      await ctx.reply('❌ Not connected. Use /login first.');
      return;
    }

    try {
      const s = await traktService.getUserStats(accessToken);

      if (!s.available) {
        await ctx.reply(
          '⚠️ *Trakt stats are unavailable right now*\n\n' +
            'Trakt\'s stats endpoint is returning empty responses for many users. ' +
            'This is a known issue on Trakt\'s side and is affecting multiple apps.\n\n' +
            'Your numbers will reappear automatically once Trakt fixes it. ' +
            'No action needed from you.',
          { parse_mode: 'Markdown' },
        );
        return;
      }

      const lines = [
        '📊 *Your Trakt Stats*',
        '',
        `🎬 Movies watched: *${s.moviesWatched}*`,
        `📺 Episodes watched: *${s.episodesWatched}*`,
        `📼 Shows watched: *${s.showsWatched}*`,
        `🔁 Total plays: *${s.moviesWatched + s.episodesWatched}*`,
        `⭐ Ratings given: *${s.ratingsGiven}*`,
        '',
        '⏱ *Total time watched*',
        `🎬 Movies: *${formatWatchTime(s.movieMinutes)}*`,
        `📺 Episodes: *${formatWatchTime(s.episodeMinutes)}*`,
        `📊 Total: *${formatWatchTime(s.totalMinutes)}*`,
      ];

      await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
    } catch (err) {
      logger.error('Error in /stats command', err);
      await ctx.reply('❌ Failed to load stats. Try again later.');
    }
  });
}