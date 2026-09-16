import type { Context } from 'grammy';
import type { TraktService } from '../../services/trakt';
import type { OAuthService } from '../../services/oauth';
import { buildManagementKeyboard } from '../menus';
import { formatGenres, formatRating, formatRatingStars, formatTraktUrl, escapeHtml } from '../../utils/format';
import logger from '../../utils/logger';

function formatUtcDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    const date = d.toISOString().slice(0, 10);
    const time = d.toISOString().slice(11, 16);
    return `${date} ${time} UTC`;
  } catch {
    return iso;
  }
}

export interface DetailsNav {
  from?: string;
  sid?: number;
  sn?: number;
}

function extractPoster(item: any): string | undefined {
  const images = item.images ?? item.movie?.images ?? item.show?.images;
  if (!images) return undefined;
  if (typeof images.poster === 'string') return images.poster as string;
  if (Array.isArray(images.poster) && images.poster.length) return images.poster[0];
  if (typeof images.poster === 'object') return (images.poster as any).full || (images.poster as any).thumb;
  return undefined;
}

function buildStatusLine(options: {
  rating?: number | null;
  watchlist?: boolean | null;
  lastWatched?: string | null;
  playCount?: number | null;
  authenticated: boolean;
}): string {
  const pieces: string[] = [];
  if (options.rating != null) pieces.push(`⭐ ${formatRating(options.rating)}`);
  if (options.watchlist != null) pieces.push(options.watchlist ? '📝 In Watchlist' : '📝 Not in Watchlist');

  if (options.playCount != null && options.playCount > 0) {
    const lastStr = options.lastWatched ? ` • last on ${options.lastWatched}` : '';
    pieces.push(`👁 Watched ${options.playCount}×${lastStr}`);
  } else if (options.lastWatched) {
    pieces.push(`👁 Last watched ${options.lastWatched}`);
  }

  if (!options.authenticated) pieces.push('🔐 Connect for personalized status');
  return pieces.length > 0 ? pieces.join(' • ') : 'No user status available.';
}

export async function renderDetails(
  ctx: Context,
  traktService: TraktService,
  oauthService: OAuthService | undefined,
  type: string,
  id: number,
  nav?: DetailsNav,
) {
  try {
    const isEpisode = type === 'episode';
    const item = isEpisode
      ? await traktService.getEpisodeById(id)
      : await traktService.getItemById(type as 'movie' | 'show', id);

    const title = item.title ?? item.name ?? 'Unknown';
    const year = item.year ?? item.first_aired?.slice(0, 4) ?? item.show?.year ?? '';
    const metadataRating = item.rating ?? null;
    const genres = formatGenres(item.genres ?? item.show?.genres ?? []);
    const overview = item.overview ?? 'No overview available.';
    const poster = extractPoster(item);
    const traktUrl = isEpisode
      ? `https://trakt.tv/${item.show?.ids?.slug ? `shows/${item.show.ids.slug}/seasons/${item.season}/episodes/${item.number}` : 'trakt'}`
      : formatTraktUrl(type as 'movie' | 'show', item.ids ?? {});

    let watchlistStatus: boolean | null = null;
    let userRating: number | null = null;
    let lastWatched: string | null = null;
    let playCount: number | null = null;
    let authenticated = false;
    let progressSummary: string | null = null;

    const accessToken = ctx.from && oauthService ? await oauthService.getValidAccessToken(ctx.from.id) : null;
    authenticated = Boolean(accessToken);

    if (accessToken && !isEpisode) {
      const [ratingResult, listResult, summaryResult, progressResult] = await Promise.allSettled([
        traktService.getUserRating(accessToken, type as 'movie' | 'show', id),
        traktService.getWatchlistStatus(accessToken, type as 'movie' | 'show', id),
        traktService.getWatchedSummary(accessToken, type as 'movie' | 'show', id),
        type === 'show' ? traktService.getShowProgress(accessToken, id) : Promise.resolve(null),
      ]);

      if (ratingResult.status === 'fulfilled' && typeof ratingResult.value === 'number') {
        userRating = ratingResult.value;
      }
      if (listResult.status === 'fulfilled') {
        watchlistStatus = listResult.value;
      }
      if (summaryResult.status === 'fulfilled' && summaryResult.value) {
        const summary = summaryResult.value;
        playCount = summary.plays > 0 ? summary.plays : null;
        lastWatched = summary.last_watched_at
          ? formatUtcDateTime(summary.last_watched_at)
          : null;
      }
      if (progressResult.status === 'fulfilled' && progressResult.value) {
        const progress = progressResult.value;
        if (progress.completed_episodes != null && progress.aired_episodes != null) {
          const percent = progress.aired_episodes > 0
            ? Math.round((progress.completed_episodes / progress.aired_episodes) * 100)
            : 0;
          const nextEpisode = progress.next_episode;
          const nextText = nextEpisode ? `Next: S${nextEpisode.season}E${nextEpisode.number}` : 'No next episode available';
          progressSummary = `Progress: ${percent}% • ${progress.completed_episodes}/${progress.aired_episodes} episodes watched • ${nextText}`;
        }
      }
    }

    if (accessToken && isEpisode) {
      try {
        const history = await traktService.getEpisodeHistory(accessToken, id);
        if (Array.isArray(history) && history.length > 0) {
          const last = history[0];
          lastWatched = last.watched_at ? formatUtcDateTime(last.watched_at) : null;
          playCount = history.length;
        }
      } catch (err) {
        logger.warn('Failed to fetch episode history', err);
      }

      try {
        const rating = await traktService.getUserRating(accessToken, 'episode', id);
        if (typeof rating === 'number') userRating = rating;
      } catch (err) {
        logger.warn('Failed to fetch episode rating', err);
      }
    }

    if (accessToken && isEpisode) {
      try {
        const history = await traktService.getEpisodeHistory(accessToken, id);
        if (Array.isArray(history) && history.length > 0) {
          const last = history[0];
          lastWatched = last.watched_at
            ? formatUtcDateTime(last.watched_at)
            : null;
          playCount = history.length;
        }
      } catch (err) {
        logger.warn('Failed to fetch episode history', err);
      }
    }

    let castItems: any[] = [];
    try {
      if (isEpisode) {
        const showId = item.show?.ids?.trakt;
        castItems = showId ? await traktService.getItemCast('show', showId) : [];
      } else {
        castItems = await traktService.getItemCast(type as 'movie' | 'show', id);
      }
    } catch (err) {
      logger.warn('Failed to fetch cast', err);
      castItems = [];
    }

    const castList = castItems
      .filter((entry) => entry.person?.name)
      .slice(0, 6)
      .map((entry) => escapeHtml(entry.person?.name ?? 'Unknown'))
      .join(', ') || 'No cast available.';

    const captionLines = [
      `<b>${escapeHtml(title)}${year ? ` (${escapeHtml(String(year))})` : ''}</b>`,
      '',
      `⭐ Rating ${formatRating(metadataRating)}`,
      `🎭 ${escapeHtml(genres)}`,
    ];

    if (isEpisode) {
      captionLines.push('', `📺 ${escapeHtml(item.show?.title ?? item.show?.name ?? 'Unknown show')}`);
      captionLines.push(`🎞 Episode: S${item.season ?? '?'}E${item.number ?? '?'}`);
    }

    captionLines.push('', `🎬 Cast: ${castList}`);
    captionLines.push('', `📝 <tg-spoiler>${escapeHtml(overview)}</tg-spoiler>`);
    if (progressSummary) captionLines.push('', `📊 ${escapeHtml(progressSummary)}`);

    const personalLines: string[] = [];
    if (userRating != null) {
      personalLines.push(`⭐ Your rating: ${formatRatingStars(userRating)}`);
    }
    if (watchlistStatus === true) {
      personalLines.push('📝 In Watchlist');
    } else if (watchlistStatus === false) {
      personalLines.push('� Not in Watchlist');
    }
    if (playCount != null && playCount > 0) {
      personalLines.push(`👁 Watched ${playCount}×`);
    }
    if (lastWatched) {
      personalLines.push(`🕐 Last on ${lastWatched}`);
    }
    if (!authenticated) {
      personalLines.push('🔐 Connect Trakt for personalized status');
    }

    if (personalLines.length > 0) {
      captionLines.push('', personalLines.join('\n'));
    }

    const keyboard = buildManagementKeyboard({
      type,
      id,
      inWatchlist: watchlistStatus ?? false,
      traktUrl,
      authenticated,
      showId: type === 'show' ? id : isEpisode ? item.show?.ids?.trakt : undefined,
      seasonNumber: isEpisode ? item.season : undefined,
      hasNextEpisode: type === 'show' && !!progressSummary && progressSummary.includes('Next:'),
      playCount: playCount ?? 0,
      from: nav?.from,
    });

    const caption = captionLines.join('\n');
    const { respondWith } = await import('../navigate');
    if (poster) {
      await respondWith(ctx, {
        photo: poster,
        caption,
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    } else {
      await respondWith(ctx, {
        text: caption,
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    }
  } catch (err) {
    logger.error('details render error', err);
    const { respondWith } = await import('../navigate');
    await respondWith(ctx, { text: 'Failed to load details' }).catch(() => {});
  }
}