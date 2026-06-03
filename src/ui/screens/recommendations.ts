import type { Context } from 'grammy';
import type { TraktService } from '../../services/trakt';
import type { OAuthService } from '../../services/oauth';
import { buildItemActions, buildNavKeyboard } from '../menus';
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

export async function renderRecommendations(ctx: Context, traktService: TraktService, oauthService: OAuthService, page = 1) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;
  const accessToken = await oauth_service_get(oauthService, telegramId);
  if (!accessToken) {
    await ctx.reply('🔐 Please connect your Trakt account first.');
    return;
  }

  try {
    const items = await traktService.getRecommendations(accessToken, 'movies', page, 10);
    if (!items || items.length === 0) {
      await ctx.reply('No recommendations right now.');
      return;
    }

    const idx = Math.max(0, Math.min(items.length - 1, page - 1));
    const entry = items[idx];
    const movie = entry.movie ?? entry;
    const show = entry.show ?? entry;
    const title = movie?.title ?? show?.title ?? 'Unknown';
    const rating = movie?.rating ?? show?.rating ?? '';
    const genres = (movie?.genres ?? show?.genres ?? []).slice(0,3).join(', ');
    const poster = extractPoster(entry);

    const caption = `🎯 ${title}\n⭐ ${rating} | ${genres}\n\n${idx+1}/${items.length}`;

    const itemType = movie ? 'movie' : show ? 'show' : '';
    const id = movie?.ids?.trakt ?? show?.ids?.trakt;
    const actions = buildItemActions({ type: itemType, id });
    const nav = buildNavKeyboard('recommendations', page, idx > 0, idx < items.length - 1, { t: itemType, id });

    if (poster) await ctx.replyWithPhoto(poster, { caption, reply_markup: { inline_keyboard: [...(actions.inline_keyboard ?? []), ...(nav.inline_keyboard ?? [])] } });
    else await ctx.reply(caption, { reply_markup: { inline_keyboard: [...(actions.inline_keyboard ?? []), ...(nav.inline_keyboard ?? [])] } });
  } catch (err) {
    logger.error('recommendations render error', err);
    await ctx.reply('Failed to load recommendations');
  }
}

// helper to get access token safely
async function oauth_service_get(oauth: OAuthService, telegramId: number) {
  try { return await oauth.getValidAccessToken(telegramId); } catch { return null; }
}
