import type { InlineKeyboardMarkup } from '@grammyjs/types';
import { encodeCallback } from '../utils/callbackData';

export function buildMainMenu(isAuthenticated: boolean): InlineKeyboardMarkup {
  const authRow = isAuthenticated
    ? [{ text: '👤 Profile', callback_data: 'a:account' }]
    : [{ text: '🔐 Connect Trakt', callback_data: 'a:connect' }];

  return {
    inline_keyboard: [
      [
        { text: '📺 Continue Watching', callback_data: 'a:continue' },
        { text: '📅 Calendar', callback_data: 'a:calendar' },
        { text: '🔍 Search', callback_data: 'a:search' },
      ],
      [
        { text: '📝 Watchlist', callback_data: 'a:watchlist' },
        { text: '📜 History', callback_data: 'a:history' },
        { text: '🎯 Recommendations', callback_data: 'a:recommendations' },
      ],
      [
        authRow[0],
        { text: '🔥 Trending', callback_data: 'a:trending' },
        { text: '🏠 Home', callback_data: 'a:home' },
      ],
    ],
  } as InlineKeyboardMarkup;
}

export function buildItemActions(opts: { type: string; id?: number | string; page?: number } | null): InlineKeyboardMarkup {
  const item = opts ?? { type: '', id: undefined };
  const detailsCb = encodeCallback('details', { t: item.type, id: item.id });
  const markCb = encodeCallback('markwatched', { t: item.type, id: item.id });
  const watchNowCb = encodeCallback('watching_now', { t: item.type, id: item.id });

  return {
    inline_keyboard: [
      [{ text: '📄 Details', callback_data: detailsCb }, { text: '✅ Mark Watched', callback_data: markCb }, { text: '📺 Watching Now', callback_data: watchNowCb }],
      [{ text: '🏠 Home', callback_data: encodeCallback('home') }],
    ],
  } as InlineKeyboardMarkup;
}

export function buildManagementKeyboard(opts: { type: string; id: number | string; inWatchlist?: boolean; traktUrl?: string; authenticated?: boolean }): InlineKeyboardMarkup {
  const itemType = opts.type;
  const itemId = opts.id;
  const authenticated = opts.authenticated ?? true;

  if (!authenticated) {
    return {
      inline_keyboard: [
        [{ text: '🔐 Connect Trakt', callback_data: encodeCallback('connect') }],
        [{ text: '🎬 Trakt', url: opts.traktUrl ?? `https://trakt.tv/${itemType}s/${itemId}` }],
        [{ text: '🏠 Home', callback_data: encodeCallback('home') }],
      ],
    } as InlineKeyboardMarkup;
  }

  const watchlistCb = opts.inWatchlist ? encodeCallback('remove_watchlist', { t: itemType, id: itemId }) : encodeCallback('add_watchlist', { t: itemType, id: itemId });
  const watchlistText = opts.inWatchlist ? '❌ Remove from Watchlist' : '➕ Add to Watchlist';

  return {
    inline_keyboard: [
      [
        { text: watchlistText, callback_data: watchlistCb },
        { text: '✅ Watched', callback_data: encodeCallback('markwatched', { t: itemType, id: itemId }) },
      ],
      [
        { text: '📺 Watching Now', callback_data: encodeCallback('watching_now', { t: itemType, id: itemId }) },
        { text: '⭐ Rate', callback_data: encodeCallback('rate_prompt', { t: itemType, id: itemId }) },
      ],
      [
        { text: '📜 History', callback_data: encodeCallback('history') },
        { text: '🎯 Similar', callback_data: encodeCallback('similar', { t: itemType, id: itemId, page: 1 }) },
      ],
      [
        { text: '🎬 Trakt', url: opts.traktUrl ?? `https://trakt.tv/${itemType}s/${itemId}` },
        { text: '🏠 Home', callback_data: encodeCallback('home') },
      ],
    ],
  } as InlineKeyboardMarkup;
}

export function buildNavKeyboard(action: string, page: number, hasPrev: boolean, hasNext: boolean, extra: Record<string, string | number> = {}): InlineKeyboardMarkup {
  const row: Array<{ text: string; callback_data: string }> = [];
  if (hasPrev) row.push({ text: '◀ Previous', callback_data: encodeCallback(action, { ...extra, page: page - 1 }) });
  if (hasNext) row.push({ text: 'Next ▶', callback_data: encodeCallback(action, { ...extra, page: page + 1 }) });
  row.push({ text: '🏠 Home', callback_data: encodeCallback('home') });
  return { inline_keyboard: [row] } as InlineKeyboardMarkup;
}

export function buildRatingKeyboard(prefixAction = 'rate', extra: Record<string, string | number> = {}) {
  const values = [1,2,3,4,5,6,7,8,9,10];
  const rows: any[] = [];
  for (let i = 0; i < values.length; i += 5) {
    const row = values.slice(i, i + 5).map((v) => ({ text: `${v}`, callback_data: encodeCallback(prefixAction, { ...extra, v }) }));
    rows.push(row);
  }
  rows.push([{ text: '🏠 Home', callback_data: encodeCallback('home') }]);
  return { inline_keyboard: rows } as InlineKeyboardMarkup;
}
