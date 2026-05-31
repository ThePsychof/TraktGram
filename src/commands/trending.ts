import type { Bot } from 'grammy';
import traktService from '../services/trakt';
import logger from '../utils/logger';

// Register `/trending` command — fetches top trending movies via Trakt service.
export function registerTrending(bot: Bot) {
  bot.command('trending', async (ctx) => {
    await ctx.reply('Fetching trending movies...');

    try {
      const items = await traktService.getTrendingMovies(5);

      if (!items || items.length === 0) {
        await ctx.reply('No trending movies found.');
        return;
      }

      const lines = items.map((it, i) => {
        const title = it.movie?.title ?? 'Unknown';
        const year = it.movie?.year ?? 'N/A';
        const watchers = it.watchers ?? 'N/A';
        return `${i + 1}. ${title} (${year}) — ${watchers} watchers`;
      });

      const message = `Top ${items.length} trending movies on Trakt:\n\n${lines.join('\n')}`;
      await ctx.reply(message);
    } catch (err) {
      logger.error('Error in /trending command', err);
      await ctx.reply('Sorry — could not fetch trending movies right now. Try again later.');
    }
  });
}
