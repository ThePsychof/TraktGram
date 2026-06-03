import type { Context } from 'grammy';
import type { TraktService } from '../../services/trakt';
import type { OAuthService } from '../../services/oauth';
import { buildItemActions, buildNavKeyboard } from '../menus';
import { encodeCallback } from '../../utils/callbackData';
import logger from '../../utils/logger';

function extractPoster(item: any): string | undefined {
  const movie = item.movie ?? item;
  const show = item.show ?? item;
  const images = movie?.images ?? show?.images ?? item.images;
  if (!images) return undefined;
  if (typeof images.poster === 'string') return images.poster as string;
  if (Array.isArray(images.poster) && images.poster.length) return images.poster[0];
  if (typeof images.poster === 'object') return (images.poster as any).full || (images.poster as any).thumb;
  return undefined;
}

export async function renderWatchlist(ctx: Context, traktService: TraktService, oauthService: OAuthService, page = 1) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const accessToken = await oauthService.getValidAccessToken(telegramId);
  if (!accessToken) {
    await ctx.reply('🔐 Please connect your Trakt account first.', { reply_markup: { inline_keyboard: [[{ text: '🔐 Connect Trakt', callback_data: encodeCallback('connect') }], [{ text: '🏠 Home', callback_data: encodeCallback('home') }]] } });
    return;
  }

  try {
    const items = await traktService.getWatchlist(accessToken, 'all', 1, 50);
    if (!items || items.length === 0) {
      await ctx.reply('Your watchlist is empty.');
      return;
    }

    const total = items.length;
    const idx = Math.max(0, Math.min(total - 1, page - 1));
    const entry = items[idx];

    const movie = entry.movie ?? null;
    const show = entry.show ?? null;
    const title = movie?.title ?? show?.title ?? movie?.name ?? show?.name ?? 'Unknown';
    const year = movie?.year ?? show?.year ?? '';
    const imdb = movie?.ids?.imdb ?? show?.ids?.imdb ?? '';

    const poster = extractPoster(entry) ?? undefined;

    const caption = `📝 Watchlist\n${title}${year ? ` (${year})` : ''}${imdb ? `\nIMDb: ${imdb}` : ''}\n\n${idx + 1}/${total}`;

    const itemType = movie ? 'movie' : show ? 'show' : '';
    const itemId = (movie?.ids?.trakt ?? show?.ids?.trakt) as number | undefined;

    const actions = buildItemActions({ type: itemType, id: itemId });
    // Add explicit remove button
    const removeCb = encodeCallback('remove_watchlist', { t: itemType, id: itemId });
    const extraParams: Record<string, string | number> = { t: itemType };
    if (itemId !== undefined) {
      extraParams.id = itemId;
    }
    const nav = buildNavKeyboard('watchlist', page, idx > 0, idx < total - 1, extraParams);

    const combinedKeyboard = [ ...(actions.inline_keyboard ?? []), [[{ text: '❌ Remove', callback_data: removeCb }]], ...(nav.inline_keyboard ?? []) ] as any[][];

    if (poster) {
      await ctx.replyWithPhoto(poster, { caption, reply_markup: { inline_keyboard: combinedKeyboard } });
    } else {
      await ctx.reply(caption, { reply_markup: { inline_keyboard: combinedKeyboard } });
    }
  } catch (error) {
    logger.error('Error rendering watchlist', error);
    await ctx.reply('Failed to load watchlist. Try again later.');
  }
}
