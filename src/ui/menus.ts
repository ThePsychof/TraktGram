import type { InlineKeyboardMarkup } from '@grammyjs/types';
import { encodeCallback } from '../utils/callbackData';

export function buildMainMenu(isAuthenticated: boolean): InlineKeyboardMarkup {
  const rows: any[] = [
    [
      { text: '🔍 Search', callback_data: 'a:search' },
      { text: '🔥 Trending', callback_data: 'a:trending' },
    ],
  ];

  if (isAuthenticated) {
    rows.push([
      { text: '📜 History', callback_data: 'a:history' },
      { text: '👤 Profile', callback_data: 'a:account' },
    ]);
  } else {
    rows.push([{ text: '🔐 Connect Trakt', callback_data: 'a:connect' }]);
  }

  return { inline_keyboard: rows } as InlineKeyboardMarkup;
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

export function buildManagementKeyboard(opts: {
  type: string;
  id: number | string;
  inWatchlist?: boolean;
  traktUrl?: string;
  authenticated?: boolean;
  showId?: number;
  seasonNumber?: number;
  hasNextEpisode?: boolean;
  playCount?: number;
  from?: string;
}): InlineKeyboardMarkup {
  const itemType = opts.type;
  const itemId = opts.id;
  const authenticated = opts.authenticated ?? true;
  const playCount = opts.playCount ?? 0;
  const hasPlayed = playCount > 0;
  const from = opts.from;

  if (!authenticated) {
    return {
      inline_keyboard: [
        [{ text: '🔐 Connect Trakt', callback_data: encodeCallback('connect') }],
        [
          { text: '🎬 Trakt', url: opts.traktUrl ?? `https://trakt.tv/${itemType}s/${itemId}` },
          { text: '🏠 Home', callback_data: encodeCallback('home') },
        ],
      ],
    } as InlineKeyboardMarkup;
  }

  // EPISODE
  if (itemType === 'episode') {
    const rows: any[] = [];

    if (hasPlayed) {
      rows.push([
        { text: '📺 Watching Now', callback_data: encodeCallback('watching_now', { t: itemType, id: itemId }) },
        { text: '🔄 Another Time', callback_data: encodeCallback('markwatched_again', { t: itemType, id: itemId }) },
      ]);
      rows.push([
        { text: '❓ No Date', callback_data: encodeCallback('markwatched_unknown', { t: itemType, id: itemId }) },
        { text: '⭐ Rate', callback_data: encodeCallback('rate_prompt', { t: itemType, id: itemId }) },
      ]);
    } else {
      rows.push([
        { text: '✅ Watched', callback_data: encodeCallback('markwatched', { t: itemType, id: itemId }) },
        { text: '📺 Watching Now', callback_data: encodeCallback('watching_now', { t: itemType, id: itemId }) },
      ]);
      rows.push([
        { text: '🔄 Another Time', callback_data: encodeCallback('markwatched_again', { t: itemType, id: itemId }) },
        { text: '❓ No Date', callback_data: encodeCallback('markwatched_unknown', { t: itemType, id: itemId }) },
      ]);
      rows.push([
        { text: '⭐ Rate', callback_data: encodeCallback('rate_prompt', { t: itemType, id: itemId }) },
        { text: '🎬 Trakt', url: opts.traktUrl ?? `https://trakt.tv/episodes/${itemId}` },
      ]);
      if (opts.showId && opts.seasonNumber != null) {
        rows.push([
          { text: '⬅️ Season', callback_data: encodeCallback('season', { id: opts.showId, s: opts.seasonNumber }) },
          { text: '🏠 Home', callback_data: encodeCallback('home') },
        ]);
      } else {
        rows.push([{ text: '🏠 Home', callback_data: encodeCallback('home') }]);
      }
      return { inline_keyboard: rows } as InlineKeyboardMarkup;
    }

    // watched path continues
    rows.push([
      { text: '🎬 Trakt', url: opts.traktUrl ?? `https://trakt.tv/episodes/${itemId}` },
      opts.showId && opts.seasonNumber != null
        ? { text: '⬅️ Season', callback_data: encodeCallback('season', { id: opts.showId, s: opts.seasonNumber }) }
        : { text: '🏠 Home', callback_data: encodeCallback('home') },
    ]);
    if (opts.showId && opts.seasonNumber != null) {
      rows.push([{ text: '🏠 Home', callback_data: encodeCallback('home') }]);
    }
    return { inline_keyboard: rows } as InlineKeyboardMarkup;
  }

  // SHOW
  if (itemType === 'show') {
    const rows: any[] = [];

    const epRow: any[] = [
      { text: '📺 Episodes', callback_data: encodeCallback('seasons', { id: itemId }) },
    ];
    if (opts.hasNextEpisode) {
      epRow.push({ text: '▶ Next', callback_data: encodeCallback('next_ep', { id: itemId }) });
    }
    rows.push(epRow);

    const watchlistCb = opts.inWatchlist
      ? encodeCallback('remove_watchlist', { t: itemType, id: itemId })
      : encodeCallback('add_watchlist', { t: itemType, id: itemId });
    const watchlistText = opts.inWatchlist ? '❌ Watchlist' : '➕ Watchlist';

    rows.push([
      { text: watchlistText, callback_data: watchlistCb },
      { text: '⭐ Rate', callback_data: encodeCallback('rate_prompt', { t: itemType, id: itemId }) },
    ]);

    if (hasPlayed) {
      rows.push([
        { text: '📺 Watching Now', callback_data: encodeCallback('watching_now', { t: itemType, id: itemId }) },
        { text: '🔁 Watch Again', callback_data: encodeCallback('watch_again', { t: itemType, id: itemId }) },
      ]);
      rows.push([
        { text: '❓ No Date', callback_data: encodeCallback('markwatched_unknown', { t: itemType, id: itemId }) },
        { text: '🎬 Trakt', url: opts.traktUrl ?? `https://trakt.tv/shows/${itemId}` },
      ]);
    } else {
      rows.push([
        { text: '📺 Watching Now', callback_data: encodeCallback('watching_now', { t: itemType, id: itemId }) },
        { text: '❓ No Date', callback_data: encodeCallback('markwatched_unknown', { t: itemType, id: itemId }) },
      ]);
      rows.push([
        { text: '🎬 Trakt', url: opts.traktUrl ?? `https://trakt.tv/shows/${itemId}` },
        { text: '🏠 Home', callback_data: encodeCallback('home') },
      ]);
    }

    if (from === 'trending') {
      rows.push([{ text: '⬅️ Trending', callback_data: encodeCallback('trending') }]);
    }

    return { inline_keyboard: rows } as InlineKeyboardMarkup;
  }

  // MOVIE
  const watchlistCb = opts.inWatchlist
    ? encodeCallback('remove_watchlist', { t: itemType, id: itemId })
    : encodeCallback('add_watchlist', { t: itemType, id: itemId });
  const watchlistText = opts.inWatchlist ? '❌ Watchlist' : '➕ Watchlist';

  const rows: any[] = [
    [{ text: watchlistText, callback_data: watchlistCb }],
  ];

  if (hasPlayed) {
    rows.push([
      { text: '📺 Watching Now', callback_data: encodeCallback('watching_now', { t: itemType, id: itemId }) },
      { text: '🔄 Another Time', callback_data: encodeCallback('markwatched_again', { t: itemType, id: itemId }) },
    ]);
    rows.push([
      { text: '❓ No Date', callback_data: encodeCallback('markwatched_unknown', { t: itemType, id: itemId }) },
      { text: '⭐ Rate', callback_data: encodeCallback('rate_prompt', { t: itemType, id: itemId }) },
    ]);
  } else {
    rows.push([
      { text: '✅ Watched', callback_data: encodeCallback('markwatched', { t: itemType, id: itemId }) },
      { text: '📺 Watching Now', callback_data: encodeCallback('watching_now', { t: itemType, id: itemId }) },
    ]);
    rows.push([
      { text: '🔄 Another Time', callback_data: encodeCallback('markwatched_again', { t: itemType, id: itemId }) },
      { text: '❓ No Date', callback_data: encodeCallback('markwatched_unknown', { t: itemType, id: itemId }) },
    ]);
    rows.push([
      { text: '⭐ Rate', callback_data: encodeCallback('rate_prompt', { t: itemType, id: itemId }) },
      { text: '🎬 Trakt', url: opts.traktUrl ?? `https://trakt.tv/movies/${itemId}` },
    ]);
    rows.push([
      { text: '📜 History', callback_data: encodeCallback('history') },
      { text: '🏠 Home', callback_data: encodeCallback('home') },
    ]);
    if (from === 'trending') {
      rows.push([{ text: '⬅️ Trending', callback_data: encodeCallback('trending') }]);
    }
    return { inline_keyboard: rows } as InlineKeyboardMarkup;
  }

  rows.push([
    { text: '📜 History', callback_data: encodeCallback('history') },
    { text: '🎬 Trakt', url: opts.traktUrl ?? `https://trakt.tv/movies/${itemId}` },
  ]);
  rows.push([{ text: '🏠 Home', callback_data: encodeCallback('home') }]);
  if (from === 'trending') {
    rows.push([{ text: '⬅️ Trending', callback_data: encodeCallback('trending') }]);
  }

  return { inline_keyboard: rows } as InlineKeyboardMarkup;
}

export function buildNavKeyboard(action: string, page: number, hasPrev: boolean, hasNext: boolean, extra: Record<string, string | number> = {}): InlineKeyboardMarkup {
  const row: Array<{ text: string; callback_data: string }> = [];
  if (hasPrev) row.push({ text: '◀ Previous', callback_data: encodeCallback(action, { ...extra, page: page - 1 }) });
  if (hasNext) row.push({ text: 'Next ▶', callback_data: encodeCallback(action, { ...extra, page: page + 1 }) });
  row.push({ text: '🏠 Home', callback_data: encodeCallback('home') });
  return { inline_keyboard: [row] } as InlineKeyboardMarkup;
}

export function buildRatingKeyboard(prefixAction = 'rate', extra: Record<string, string | number> = {}) {
  // Trakt stores 1-10 internally. We display as a 5-star scale with half-steps.
  const values: Array<{ v: number; label: string }> = [
    { v: 1, label: '½' },
    { v: 2, label: '1' },
    { v: 3, label: '1½' },
    { v: 4, label: '2' },
    { v: 5, label: '2½' },
    { v: 6, label: '3' },
    { v: 7, label: '3½' },
    { v: 8, label: '4' },
    { v: 9, label: '4½' },
    { v: 10, label: '5' },
  ];
  const rows: any[] = [];
  for (let i = 0; i < values.length; i += 5) {
    const row = values.slice(i, i + 5).map((item) => ({
      text: item.label,
      callback_data: encodeCallback(prefixAction, { ...extra, v: item.v }),
    }));
    rows.push(row);
  }
  rows.push([{ text: '🏠 Home', callback_data: encodeCallback('home') }]);
  return { inline_keyboard: rows } as InlineKeyboardMarkup;
}
