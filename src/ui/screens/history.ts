import type { Context } from 'grammy';
import type { TraktService } from '../../services/trakt';
import type { OAuthService } from '../../services/oauth';
import { encodeCallback } from '../../utils/callbackData';
import { respondWith } from '../navigate';
import logger from '../../utils/logger';

const PAGE_SIZE = 10;

function formatDate(iso: string | undefined): string {
  if (!iso) return '';
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

export async function renderHistory(
  ctx: Context,
  traktService: TraktService,
  oauthService: OAuthService | undefined,
  page = 1,
  type = '',
): Promise<void> {
  if (!ctx.from || !oauthService) {
    await respondWith(ctx, { text: '❌ Not authenticated. Use /login first.' });
    return;
  }

  const accessToken = await oauthService.getValidAccessToken(ctx.from.id);
  if (!accessToken) {
    await respondWith(ctx, { text: '❌ Not connected. Use /login first.' });
    return;
  }

  try {
    // Trakt expects type 'movies' or 'episodes' for filtering
    const filter = type === 'movies' ? 'movies' : type === 'episodes' ? 'episodes' : '';
    const items = await traktService.getHistory(accessToken, filter, page, PAGE_SIZE);
    const hasNext = items.length >= PAGE_SIZE;
    const hasPrev = page > 1;

    const rows: any[] = [];

    for (const entry of items) {
      const kind = entry.type;
      const date = formatDate(entry.watched_at);
      let label = '';
      let cbType = '';
      let cbId = 0;

      if (kind === 'movie' && entry.movie) {
        const title = (entry.movie.title ?? 'Unknown').slice(0, 30);
        const year = entry.movie.year ?? '';
        label = `🎬 ${title}${year ? ` (${year})` : ''} • ${date}`;
        cbType = 'movie';
        cbId = entry.movie.ids?.trakt;
      } else if (kind === 'episode' && entry.episode) {
        const showTitle = (entry.show?.title ?? 'Unknown').slice(0, 22);
        const s = entry.episode.season ?? 0;
        const e = entry.episode.number ?? 0;
        label = `📺 ${showTitle} S${String(s).padStart(2, '0')}E${String(e).padStart(2, '0')} • ${date}`;
        cbType = 'episode';
        cbId = entry.episode.ids?.trakt;
      } else {
        continue;
      }

      if (!cbId) continue;

      rows.push([
        {
          text: label.slice(0, 60),
          callback_data: encodeCallback('details', { t: cbType, id: cbId, from: 'history' }),
        },
      ]);
    }

    if (items.length === 0) {
      rows.push([{ text: '🏠 Home', callback_data: encodeCallback('home') }]);
      await respondWith(ctx, {
        text: '📜 <b>Your History</b>\n\n<i>No entries found.</i>',
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: rows },
      });
      return;
    }

    // Filter row
    rows.push([
      {
        text: filter === 'movies' ? '✅ Movies' : '🎬 Movies',
        callback_data: encodeCallback('history', { page: 1, type: 'movies' }),
      },
      {
        text: filter === '' ? '✅ All' : '📋 All',
        callback_data: encodeCallback('history', { page: 1 }),
      },
      {
        text: filter === 'episodes' ? '✅ Shows' : '📺 Shows',
        callback_data: encodeCallback('history', { page: 1, type: 'episodes' }),
      },
    ]);

    // Nav row
    const navRow: any[] = [];
    if (hasPrev) {
      navRow.push({
        text: '◀ Prev',
        callback_data: encodeCallback('history', { page: page - 1, type: filter || undefined }),
      });
    }
    navRow.push({ text: '🏠 Home', callback_data: encodeCallback('home') });
    if (hasNext) {
      navRow.push({
        text: 'Next ▶',
        callback_data: encodeCallback('history', { page: page + 1, type: filter || undefined }),
      });
    }
    rows.push(navRow);

    const filterLabel = filter === 'movies' ? 'Movies' : filter === 'episodes' ? 'Shows' : 'All';
    await respondWith(ctx, {
      text: `📜 <b>Your History</b> • ${filterLabel}\nPage ${page}`,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: rows },
    });
  } catch (err: any) {
    logger.error('renderHistory error', err);
    const message = err?.status === 429
      ? '⏳ Trakt is rate-limiting us. Wait a minute, then try /history again.'
      : '❌ Failed to load history.';
    await respondWith(ctx, { text: message });
  }
}