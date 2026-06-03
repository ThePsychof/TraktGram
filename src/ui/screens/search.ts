import type { Context } from 'grammy';
import type { TraktService } from '../../services/trakt';
import type { OAuthService } from '../../services/oauth';
import { buildItemActions } from '../menus';
import { encodeCallback } from '../../utils/callbackData';
import logger from '../../utils/logger';

function extractPoster(item: any): string | undefined {
  const images = item.movie?.images ?? item.show?.images ?? item.images;
  if (!images) return undefined;
  if (typeof images.poster === 'string') return images.poster as string;
  if (Array.isArray(images.poster) && images.poster.length) return images.poster[0];
  if (typeof images.poster === 'object') return (images.poster as any).full || (images.poster as any).thumb;
  return undefined;
}

export async function renderSearchResults(ctx: Context, traktService: TraktService, oauthService: OAuthService, query: string, index = 0) {
  if (!query || query.length < 2) {
    await ctx.reply('Enter a search query (at least 2 characters).');
    return;
  }

  try {
    logger.info('Searching for:', { query, index });
    const results = await traktService.searchMulti(query, 20);
    
    if (!results || results.length === 0) {
      logger.warn('No results found', { query });
      await ctx.reply(`No results found for "${query}".`);
      return;
    }

    logger.info('Found results', { count: results.length });

    const idx = Math.max(0, Math.min(results.length - 1, index));
    const result = results[idx];

    const movie = result.movie;
    const show = result.show;
    const title = movie?.title ?? show?.title ?? 'Unknown';
    const year = movie?.year ?? show?.year ?? '';
    const type = movie ? 'movie' : show ? 'show' : result.type;
    const rating = movie?.rating ?? show?.rating ?? '';
    const overview = movie?.overview ?? show?.overview ?? '';
    const poster = extractPoster(result);

    const itemId = (movie?.ids?.trakt ?? show?.ids?.trakt) as number | undefined;

    const caption = `🎬 ${title}${year ? ` (${year})` : ''}\n⭐ ${rating}\n\n${overview}\n\n${idx + 1}/${results.length}`;

    const actions = buildItemActions({ type: type as string, id: itemId });
    const addWatchlistCb = encodeCallback('add_watchlist', { t: type, id: itemId });

    const navRow: any[] = [];
    if (idx > 0) navRow.push({ text: '◀ Previous', callback_data: encodeCallback('search_result', { q: query.slice(0, 25), i: idx - 1 }) });
    if (idx < results.length - 1) navRow.push({ text: 'Next ▶', callback_data: encodeCallback('search_result', { q: query.slice(0, 25), i: idx + 1 }) });
    navRow.push({ text: '🏠 Home', callback_data: encodeCallback('home') });

    const keyboard = [
      ...(actions.inline_keyboard ?? []),
      [[{ text: '➕ Watchlist', callback_data: addWatchlistCb }]],
      [navRow]
    ];

    if (poster) {
      await ctx.replyWithPhoto(poster, { caption, reply_markup: { inline_keyboard: keyboard } });
    } else {
      await ctx.reply(caption, { reply_markup: { inline_keyboard: keyboard } });
    }
  } catch (error) {
    logger.error('Search error', error);
    await ctx.reply(`Failed to search for "${query}". Try again later.`);
  }
}
