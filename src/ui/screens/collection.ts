import type { Context } from 'grammy';
import type { TraktService } from '../../services/trakt';
import type { OAuthService } from '../../services/oauth';
import { buildItemActions, buildNavKeyboard } from '../menus';
import { encodeCallback } from '../../utils/callbackData';
import { extractPoster } from '../../utils/images';
import logger from '../../utils/logger';


export async function renderCollection(ctx: Context, traktService: TraktService, oauthService: OAuthService, page = 1) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const accessToken = await oauthService.getValidAccessToken(telegramId);
  if (!accessToken) {
    await ctx.reply('🔐 Please connect your Trakt account first.', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔐 Connect Trakt', callback_data: encodeCallback('connect') }],
          [{ text: '🏠 Home', callback_data: encodeCallback('home') }],
        ],
      },
    });
    return;
  }

  try {
    const items = await traktService.getCollection(accessToken, 'all', page, 50);
    if (!items || items.length === 0) {
      await ctx.reply('Your collection is empty.', {
        reply_markup: { inline_keyboard: [[{ text: '🏠 Home', callback_data: encodeCallback('home') }]] },
      });
      return;
    }

    const total = items.length;
    const idx = Math.max(0, Math.min(total - 1, page - 1));
    const entry = items[idx];
    const movie = entry.movie ?? null;
    const show = entry.show ?? null;
    const title = movie?.title ?? show?.title ?? movie?.name ?? show?.name ?? 'Unknown';
    const year = movie?.year ?? show?.year ?? '';
    const poster = extractPoster(entry) ?? undefined;
    const caption = `📦 Collection\n${title}${year ? ` (${year})` : ''}\n\n${idx + 1}/${total}`;

    const itemType = movie ? 'movie' : show ? 'show' : '';
    const itemId = (movie?.ids?.trakt ?? show?.ids?.trakt) as number | undefined;
    const actions = buildItemActions({ type: itemType, id: itemId });
    const extraParams: Record<string, string | number> = { t: itemType };
    if (itemId !== undefined) {
      extraParams.id = itemId;
    }
    const nav = buildNavKeyboard('collection', page, idx > 0, idx < total - 1, extraParams);
    const combinedKeyboard = [...(actions.inline_keyboard ?? []), ...(nav.inline_keyboard ?? [])] as any[][];

    if (poster) {
      await ctx.replyWithPhoto(poster, { caption, reply_markup: { inline_keyboard: combinedKeyboard } });
    } else {
      await ctx.reply(caption, { reply_markup: { inline_keyboard: combinedKeyboard } });
    }
  } catch (error) {
    logger.error('Error rendering collection', error);
    await ctx.reply('Failed to load collection. Try again later.', {
      reply_markup: { inline_keyboard: [[{ text: '🏠 Home', callback_data: encodeCallback('home') }]] },
    });
  }
}
