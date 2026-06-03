import type { InlineKeyboardMarkup } from 'grammy';
import { encodeCallback } from '../utils/callbackData';

export function buildMainMenu(isAuthenticated: boolean): InlineKeyboardMarkup {
  const authRow = isAuthenticated
    ? [{ text: '👤 My Account', callback_data: 'a:account' }]
    : [{ text: '🔐 Connect Trakt', callback_data: 'a:connect' }];

  return {
    inline_keyboard: [
      [
        { text: '🔥 Trending', callback_data: 'a:trending' },
        { text: '📺 Continue Watching', callback_data: 'a:continue' },
        { text: '🔍 Search', callback_data: 'a:search' },
      ],
      [
        { text: '🎯 Recommendations', callback_data: 'a:recommendations' },
        { text: '📝 Watchlist', callback_data: 'a:watchlist' },
        { text: '📜 History', callback_data: 'a:history' },
      ],
      authRow,
      [{ text: '🏠 Home', callback_data: 'a:home' }],
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

export function buildNavKeyboard(action: string, page: number, hasPrev: boolean, hasNext: boolean, extra: Record<string, string | number> = {}): InlineKeyboardMarkup {
  const row: Array<{ text: string; callback_data: string }> = [];
  if (hasPrev) row.push({ text: '◀ Previous', callback_data: encodeCallback(action, { ...extra, page: page - 1 }) });
  if (hasNext) row.push({ text: 'Next ▶', callback_data: encodeCallback(action, { ...extra, page: page + 1 }) });
  row.push({ text: '🏠 Home', callback_data: encodeCallback('home') });
  return { inline_keyboard: [row] } as InlineKeyboardMarkup;
}

export function buildRatingKeyboard(prefixAction = 'rate', extra: Record<string, string | number> = {}) {
  const values = [0.5,1,1.5,2,2.5,3,3.5,4,4.5,5];
  const rows: any[] = [];
  for (let i = 0; i < values.length; i += 5) {
    const row = values.slice(i, i+5).map(v => ({ text: `${v}`, callback_data: encodeCallback(prefixAction, { ...extra, v }) }));
    rows.push(row);
  }
  rows.push([{ text: '🏠 Home', callback_data: encodeCallback('home') }]);
  return { inline_keyboard: rows } as InlineKeyboardMarkup;
}
