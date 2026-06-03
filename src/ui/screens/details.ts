import type { Context } from 'grammy';
import type { TraktService } from '../../services/trakt';
import type { OAuthService } from '../../services/oauth';
import { buildItemActions, buildRatingKeyboard } from '../menus';
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

export async function renderDetails(ctx: Context, traktService: TraktService, oauthService: OAuthService, type: string, id: number) {
  try {
    const path = type === 'movie' ? `/movies/${id}?extended=full,images` : `/shows/${id}?extended=full,images`;
    // Use TraktService.request via private method isn't available; use existing helpers
    // Quick fetch
    const headers = (traktService as any).getHeaders ? (traktService as any).getHeaders() : {};
    const res = await fetch(`https://api.trakt.tv${path}`, { method: 'GET', headers });
    if (!res.ok) throw new Error('Failed to fetch details');
    const json = await res.json();

    const title = json.title ?? json.name ?? 'Unknown';
    const year = json.year ?? '';
    const rating = json.rating ?? '';
    const genres = (json.genres ?? []).join(', ');
    const overview = json.overview ?? '';
    const poster = extractPoster(json);

    const caption = `🎬 ${title}${year ? ` (${year})` : ''}\n⭐ ${rating} | ${genres}\n\n${overview}`;

    const itemActions = buildItemActions({ type, id });
    const ratingKb = buildRatingKeyboard('rate', { t: type, id });

    if (poster) await ctx.replyWithPhoto(poster, { caption, reply_markup: { inline_keyboard: [...(itemActions.inline_keyboard ?? []), ...(ratingKb.inline_keyboard ?? [])] } });
    else await ctx.reply(caption, { reply_markup: { inline_keyboard: [...(itemActions.inline_keyboard ?? []), ...(ratingKb.inline_keyboard ?? [])] } });
  } catch (err) {
    logger.error('details render error', err);
    await ctx.reply('Failed to load details');
  }
}
