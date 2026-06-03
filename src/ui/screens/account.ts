import type { Context } from 'grammy';
import type { TraktService } from '../../services/trakt';
import type { OAuthService } from '../../services/oauth';
import { UserService } from '../../services/user';
import { encodeCallback } from '../../utils/callbackData';
import logger from '../../utils/logger';

export async function renderAccount(ctx: Context, oauthService: OAuthService, traktService: TraktService) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  try {
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
    const ratings = stats.ratings?.total ?? 0;
    const watchlistCount = stats.watchlist?.movies ?? 0;

    const text = `👤 ${username}\nMovies watched: ${moviesWatched}\nEpisodes watched: ${episodesWatched}\nRatings: ${ratings}\nWatchlist: ${watchlistCount}`;

    await ctx.reply(text, { reply_markup: { inline_keyboard: [[{ text: '📺 Continue Watching', callback_data: encodeCallback('continue') }, { text: '📝 Watchlist', callback_data: encodeCallback('watchlist') }], [{ text: '🚪 Log Out', callback_data: encodeCallback('logout') }, { text: '🏠 Home', callback_data: encodeCallback('home') }]] } });
  } catch (err) {
    logger.error('account render error', err);
    await ctx.reply('Failed to load account');
  }
}
