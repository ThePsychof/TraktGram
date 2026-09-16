import type { Context } from 'grammy';
import type { TraktService } from '../../services/trakt';
import type { OAuthService } from '../../services/oauth';
import { UserService } from '../../services/user';
import { formatWatchTime } from '../../utils/format';
import { encodeCallback } from '../../utils/callbackData';
import logger from '../../utils/logger';

export async function renderProfile(ctx: Context, oauthService: OAuthService, traktService: TraktService) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  try {
    const accessToken = await oauthService.getValidAccessToken(telegramId);
    if (!accessToken) {
      await ctx.reply('🔐 Please connect your Trakt account first.', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔐 Connect Trakt', callback_data: encodeCallback('connect') }],
            [{ text: '🏠 Home', callback_data: encodeCallback('home') }],
          ],
        },
      });
      return;
    }

    const userSvc = new UserService(oauthService, traktService as any);
    const profile = await userSvc.getProfile(telegramId);
    if (!profile) {
      await ctx.reply('🔐 Not connected. Use Connect Trakt.');
      return;
    }

    const username = profile.oauth.username ?? 'Unknown';
    const stats = await traktService.getUserStats(accessToken);

    const lines: string[] = [`👤 <b>${username}</b>`];

    if (stats.available) {
      lines.push('');
      lines.push(`🎬 Movies watched: <b>${stats.moviesWatched}</b>`);
      lines.push(`📺 Episodes watched: <b>${stats.episodesWatched}</b>`);
      lines.push(`📼 Shows watched: <b>${stats.showsWatched}</b>`);
      lines.push(`⭐ Ratings given: <b>${stats.ratingsGiven}</b>`);
      lines.push('');
      lines.push(`⏱ Total watched: <b>${formatWatchTime(stats.totalMinutes)}</b>`);
    } else {
      lines.push('');
      lines.push('⚠️ <i>Trakt stats are temporarily unavailable (known issue on Trakt\'s side).</i>');
    }

    lines.push('');
    lines.push('Use the buttons below to explore.');

    await ctx.reply(lines.join('\n'), {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📺 Continue', callback_data: encodeCallback('continue') },
            { text: '📅 Calendar', callback_data: encodeCallback('calendar') },
          ],
          [
            { text: '📝 Watchlist', callback_data: encodeCallback('watchlist') },
            { text: '📦 Collection', callback_data: encodeCallback('collection') },
          ],
          [
            { text: '📜 History', callback_data: encodeCallback('history') },
            { text: '🎯 Recommendations', callback_data: encodeCallback('recommendations') },
          ],
          [
            { text: '🔍 Search', callback_data: encodeCallback('search') },
            { text: '🏠 Home', callback_data: encodeCallback('home') },
          ],
        ],
      },
    });
  } catch (err) {
    logger.error('profile render error', err);
    await ctx.reply('Failed to load profile');
  }
}