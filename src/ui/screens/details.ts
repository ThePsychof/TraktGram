import type { Context } from 'grammy';
import type { TraktService } from '../../services/trakt';
import type { OAuthService } from '../../services/oauth';
import { buildManagementKeyboard, buildRatingKeyboard } from '../menus';
import { formatGenres, formatRating, formatTraktUrl, escapeHtml } from '../../utils/format';
import logger from '../../utils/logger';

function extractPoster(item: any): string | undefined {
  const images = item.images ?? item.movie?.images ?? item.show?.images;
  if (!images) return undefined;
  if (typeof images.poster === 'string') return images.poster as string;
  if (Array.isArray(images.poster) && images.poster.length) return images.poster[0];
  if (typeof images.poster === 'object') return (images.poster as any).full || (images.poster as any).thumb;
  return undefined;
}

function buildStatusLine(options: { rating?: number | null; watchlist?: boolean | null; lastWatched?: string | null; playCount?: number | null; authenticated: boolean }): string {
  const pieces: string[] = [];
  if (options.rating != null) {
    pieces.push(`⭐ ${formatRating(options.rating)}`);
  }
  if (options.watchlist != null) {
    pieces.push(options.watchlist ? '📝 In Watchlist' : '📝 Not in Watchlist');
  }
  if (options.lastWatched) {
    pieces.push(`👁 ${options.lastWatched}`);
  }
  if (typeof options.playCount === 'number') {
    pieces.push(`🔁 ${options.playCount} plays`);
  }
  if (!options.authenticated) {
    pieces.push('🔐 Connect for personalized status');
  }
  return pieces.length > 0 ? pieces.join(' • ') : 'No user status available.';
}

export async function renderDetails(ctx: Context, traktService: TraktService, oauthService: OAuthService | undefined, type: string, id: number) {
  try {
    const item = await traktService.getItemById(type as 'movie' | 'show', id);
    const title = item.title ?? item.name ?? 'Unknown';
    const year = item.year ?? item.first_aired?.slice(0, 4) ?? '';
    const metadataRating = item.rating ?? null;
    const genres = formatGenres(item.genres ?? []);
    const overview = item.overview ?? 'No overview available.';
    const poster = extractPoster(item);
    const traktUrl = formatTraktUrl(type as 'movie' | 'show', item.ids ?? {});

    let watchlistStatus: boolean | null = null;
    let userRating: number | null = null;
    let lastWatched: string | null = null;
    let playCount: number | null = null;
    let authenticated = false;

    const accessToken = ctx.from && oauthService ? await oauthService.getValidAccessToken(ctx.from.id) : null;
    authenticated = Boolean(accessToken);

    if (accessToken) {
      const [ratingResult, listResult, summaryResult] = await Promise.allSettled([
        traktService.getUserRating(accessToken, type as 'movie' | 'show', id),
        traktService.getWatchlistStatus(accessToken, type as 'movie' | 'show', id),
        traktService.getWatchedSummary(accessToken, type as 'movie' | 'show', id),
      ]);

      if (ratingResult.status === 'fulfilled') {
        userRating = ratingResult.value;
      }
      if (listResult.status === 'fulfilled') {
        watchlistStatus = listResult.value;
      }
      if (summaryResult.status === 'fulfilled' && summaryResult.value) {
        lastWatched = summaryResult.value.last_watched_at ? new Date(summaryResult.value.last_watched_at).toISOString().slice(0, 10) : null;
        playCount = typeof summaryResult.value.play_count === 'number' ? summaryResult.value.play_count : null;
      }
    }

    const castItems = await traktService.getItemCast(type as 'movie' | 'show', id);
    const castList = castItems
      .filter((entry) => entry.person?.name)
      .slice(0, 6)
      .map((entry) => escapeHtml(entry.person?.name ?? 'Unknown'))
      .join(', ') || 'No cast available.';

    const captionLines = [
      `<b>${escapeHtml(title)}${year ? ` (${escapeHtml(String(year))})` : ''}</b>`,
      '',
      `⭐ IMDb ${formatRating(metadataRating)}`,
      `🎭 ${escapeHtml(genres)}`,
      '',
      `🎬 Cast: ${castList}`,
      '',
      `📝 <tg-spoiler>${escapeHtml(overview)}</tg-spoiler>`,
      '',
      `👤 ${buildStatusLine({ rating: userRating, watchlist: watchlistStatus, lastWatched, playCount, authenticated })}`,
    ];

    const keyboard = buildManagementKeyboard({
      type,
      id,
      inWatchlist: watchlistStatus ?? false,
      traktUrl,
      authenticated,
    });

    const caption = captionLines.join('\n');
    if (poster) {
      await ctx.replyWithPhoto(poster, { caption, parse_mode: 'HTML', reply_markup: keyboard });
    } else {
      await ctx.reply(caption, { parse_mode: 'HTML', reply_markup: keyboard });
    }
  } catch (err) {
    logger.error('details render error', err);
    await ctx.reply('Failed to load details');
  }
}
