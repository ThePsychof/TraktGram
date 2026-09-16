import type { Bot } from 'grammy';
import type { TraktService } from '../services/trakt';
import { encodeCallback } from '../utils/callbackData';
import logger from '../utils/logger';

export function registerTrending(bot: Bot, traktService: TraktService) {
  bot.command('trending', async (ctx) => {
    await ctx.reply('Fetching trending on Trakt...');

    try {
      const [movies, shows] = await Promise.all([
        traktService.getTrendingMovies(5).catch(() => []),
        traktService.getTrendingShows(5).catch(() => []),
      ]);

      const rows: any[] = [];

      for (const it of movies as any[]) {
        const id = it.movie?.ids?.trakt;
        if (!id) continue;
        const title = (it.movie?.title ?? 'Unknown').slice(0, 45);
        const year = it.movie?.year ?? '';
        rows.push([
          {
            text: `🎬 ${title}${year ? ` (${year})` : ''}`.slice(0, 60),
            callback_data: encodeCallback('details', { t: 'movie', id, from: 'trending' }),
          },
        ]);
      }

      for (const it of shows as any[]) {
        const id = it.show?.ids?.trakt;
        if (!id) continue;
        const title = (it.show?.title ?? 'Unknown').slice(0, 45);
        const year = it.show?.year ?? '';
        rows.push([
          {
            text: `📺 ${title}${year ? ` (${year})` : ''}`.slice(0, 60),
            callback_data: encodeCallback('details', { t: 'show', id, from: 'trending' }),
          },
        ]);
      }

      if (rows.length === 0) {
        await ctx.reply('No trending items found.');
        return;
      }

      rows.push([{ text: '🏠 Home', callback_data: encodeCallback('home') }]);

      await ctx.reply('🔥 Trending on Trakt\n\nTap any item to see details:', {
        reply_markup: { inline_keyboard: rows },
      });
    } catch (err) {
      logger.error('Error in /trending command', err);
      await ctx.reply('Sorry — could not fetch trending right now. Try again later.');
    }
  });
}