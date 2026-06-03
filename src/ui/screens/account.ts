import type { Context } from 'grammy';
import type { TraktService } from '../../services/trakt';
import type { OAuthService } from '../../services/oauth';
import { UserService } from '../../services/user';
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
    const stats = profile.stats ?? {};
    const moviesWatched = stats.movies?.watched ?? 0;
    const episodesWatched = stats.episodes?.watched ?? 0;
    const hoursWatched = stats.hours?.watched ?? 0;
    const ratings = stats.ratings?.total ?? 0;
    const watchlistMovies = stats.watchlist?.movies ?? 0;
    const watchlistShows = stats.watchlist?.shows ?? 0;
    const collectionMovies = stats.collection?.movies ?? 0;
    const collectionShows = stats.collection?.shows ?? 0;
    const watchlistCount = watchlistMovies + watchlistShows;
    const collectionCount = collectionMovies + collectionShows;

    const text = [
      `👤 ${username}`,
      `Movies watched: ${moviesWatched}`,
      `Episodes watched: ${episodesWatched}`,
      `Hours watched: ${hoursWatched}`,
      `Ratings: ${ratings}`,
      `Watchlist: ${watchlistCount}`,
      `Collection: ${collectionCount}`,
      '',
      'Recent activity is available in History.',
    ].join('\n');

    await ctx.reply(text, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📺 Continue Watching', callback_data: encodeCallback('continue') }, { text: '📅 Calendar', callback_data: encodeCallback('calendar') }],
          [{ text: '📝 Watchlist', callback_data: encodeCallback('watchlist') }, { text: '📦 Collection', callback_data: encodeCallback('collection') }],
          [{ text: '📜 History', callback_data: encodeCallback('history') }, { text: '🎯 Recommendations', callback_data: encodeCallback('recommendations') }],
          [{ text: '🔍 Search', callback_data: encodeCallback('search') }, { text: '🏠 Home', callback_data: encodeCallback('home') }],
        ],
      },
    });
  } catch (err) {
    logger.error('profile render error', err);
    await ctx.reply('Failed to load profile');
  }
}
