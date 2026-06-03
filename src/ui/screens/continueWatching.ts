import type { Context } from 'grammy';
import type { TraktService } from '../../services/trakt';
import type { OAuthService } from '../../services/oauth';
import { buildItemActions, buildNavKeyboard } from '../menus';
import logger from '../../utils/logger';
import { encodeCallback } from '../../utils/callbackData';

function extractPoster(item: any): string | undefined {
  const images = item.movie?.images ?? item.show?.images ?? item.images;
  if (!images) return undefined;
  if (typeof images.poster === 'string') return images.poster as string;
  if (Array.isArray(images.poster) && images.poster.length) return images.poster[0];
  if (typeof images.poster === 'object') return (images.poster as any).full || (images.poster as any).thumb;
  return undefined;
}

export async function renderContinueWatching(ctx: Context, traktService: TraktService, oauthService: OAuthService, page = 1) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const accessToken = await oauthService.getValidAccessToken(telegramId);
  if (!accessToken) {
    await ctx.reply('🔐 Please connect your Trakt account first.', { reply_markup: { inline_keyboard: [[{ text: '🔐 Connect Trakt', callback_data: encodeCallback('connect') }], [{ text: '🏠 Home', callback_data: encodeCallback('home') }]] } });
    return;
  }

  try {
    const items = await traktService.getContinueWatching(accessToken, 50);
    if (!items || items.length === 0) {
      await ctx.reply('No items to continue watching right now.');
      return;
    }

    const total = items.length;
    const idx = Math.max(0, Math.min(total - 1, page - 1));
    const item = items[idx];

    const title = item.movie?.title ?? item.show?.title ?? item.title ?? 'Unknown';
    const subtitle = item.episode ? `S${item.episode.season}E${item.episode.number}` : '';

    const poster = extractPoster(item) ?? undefined;

    const caption = `📺 ${title}${subtitle ? `\nNext: ${subtitle}` : ''}\n\n${idx + 1}/${total}`;

    // Build actions with item-specific ids
    const itemType = item.movie ? 'movie' : item.show ? 'show' : item.type ?? '';
    const itemId = (item.movie?.ids?.trakt ?? item.show?.ids?.trakt ?? item.ids?.trakt) as number | undefined;
    const actions = buildItemActions({ type: itemType, id: itemId });

    const nav = buildNavKeyboard('continue', page, idx > 0, idx < total - 1, { t: itemType, id: itemId });

    if (poster) {
      await ctx.replyWithPhoto(poster, { caption, reply_markup: { inline_keyboard: [...(actions.inline_keyboard ?? []), ...(nav.inline_keyboard ?? [])] } });
    } else {
      await ctx.reply(caption, { reply_markup: { inline_keyboard: [...(actions.inline_keyboard ?? []), ...(nav.inline_keyboard ?? [])] } });
    }
  } catch (error) {
    logger.error('Error rendering Continue Watching', error);
    await ctx.reply('Failed to load Continue Watching. Try again later.');
  }
}
