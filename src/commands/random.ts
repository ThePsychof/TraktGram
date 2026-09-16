import type { Bot } from 'grammy';
import type { OAuthService } from '../services/oauth';
import type { TraktService } from '../services/trakt';
import { renderDetails } from '../ui/screens/details';
import logger from '../utils/logger';

export function registerRandom(bot: Bot, traktService: TraktService, oauthService: OAuthService) {
  bot.command('random', async (ctx) => {
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
      const items = await traktService.getWatchlist(accessToken, 'all', 1, 100);
      if (!items || items.length === 0) {
        await ctx.reply('Your watchlist is empty. Add something first!');
        return;
      }

      const pick = items[Math.floor(Math.random() * items.length)];
      const meta = pick.movie ?? pick.show;
      const type = pick.movie ? 'movie' : 'show';
      const id = meta?.ids?.trakt;

      if (!id) {
        await ctx.reply('Could not pick a valid item. Try again.');
        return;
      }

      await ctx.reply(`🎲 Random pick from your watchlist:`);
      await renderDetails(ctx, traktService, oauthService, type, id);
    } catch (err) {
      logger.error('Error in /random command', err);
      await ctx.reply('❌ Failed to pick a random item. Try again later.');
    }
  });
}