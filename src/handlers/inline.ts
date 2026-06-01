import type { Bot } from 'grammy';
import type {
  InlineQueryResult,
  InlineQueryResultArticle,
  InlineQueryResultPhoto,
} from '@grammyjs/types';
import type { TraktCastEntry, TraktSearchItem } from '../types/trakt';
import type { TraktService } from '../services/trakt';
import logger from '../utils/logger';
import {
  buildEmptyInlineResponse,
  buildMessageCaption,
  buildResultDescription,
  escapeHtml,
  formatYear,
  getItemYear,
  getPosterUrlFromItem,
} from '../utils/format';

function getResultId(item: TraktSearchItem, index: number): string {
  const ids = item.movie?.ids ?? item.show?.ids ?? {};
  const uniqueId = ids.trakt ?? ids.tmdb ?? ids.imdb ?? item.movie?.title ?? item.show?.title ?? index;
  return `${item.type}-${uniqueId}`;
}

function buildPhotoResult(
  id: string,
  title: string,
  description: string,
  photoUrl: string,
  caption: string
): InlineQueryResultPhoto {
  return {
    type: 'photo',
    id,
    photo_url: photoUrl,
    thumbnail_url: photoUrl,
    title,
    description,
    caption,
    parse_mode: 'HTML',
    show_caption_above_media: true,
  };
}

function buildArticleResult(
  id: string,
  title: string,
  description: string,
  messageText: string,
  thumbUrl?: string
): InlineQueryResultArticle {
  return {
    type: 'article',
    id,
    title,
    description,
    thumbnail_url: thumbUrl,
    input_message_content: {
      message_text: messageText,
      parse_mode: 'HTML',
    },
  };
}

async function resolveInlineResult(
  item: TraktSearchItem,
  index: number,
  traktService: TraktService
) {
  const id = getResultId(item, index);
  const meta = item.movie ?? item.show;
  const title = meta?.title ?? meta?.name ?? 'Untitled';
  const year = formatYear(getItemYear(item));
  const description = buildResultDescription(item);
  const cast = await traktService.getCastForItem(item);
  const caption = buildMessageCaption(item, cast);
  const posterUrl = getPosterUrlFromItem(item);

  if (posterUrl) {
    return buildPhotoResult(id, title, description, posterUrl, caption);
  }

  return buildArticleResult(id, title, description, caption, undefined);
}

export function registerInlineQuery(
  bot: Bot,
  traktService: TraktService
) {
  bot.on('inline_query', async (ctx) => {
    const query = ctx.inlineQuery.query?.trim() ?? '';
    const results: InlineQueryResult[] = [];

    if (!query) {
      try {
        const trending = await traktService.getTrendingMovies(8);
        for (const [index, item] of trending.entries()) {
          const searchItem: TraktSearchItem = { type: 'movie', movie: item.movie };
          const result = await resolveInlineResult(searchItem, index, traktService);
          results.push(result);
        }
      } catch (error) {
        logger.error('Inline trending fallback failed', error);
      }

      await ctx.answerInlineQuery(results, {
        cache_time: 30,
        is_personal: true,
      });
      return;
    }

    try {
      const searchResults = await traktService.searchMulti(query, 10);
      const filtered = searchResults.filter((item) => item.type === 'movie' || item.type === 'show').slice(0, 10);

      if (filtered.length === 0) {
        await ctx.answerInlineQuery([
          buildArticleResult('no-results', `No results for ${escapeHtml(query)}`, buildEmptyInlineResponse(query), buildEmptyInlineResponse(query)),
        ], { cache_time: 30, is_personal: true });
        return;
      }

      for (const [index, item] of filtered.entries()) {
        const result = await resolveInlineResult(item, index, traktService);
        results.push(result);
      }

      await ctx.answerInlineQuery(results, {
        cache_time: 30,
        is_personal: true,
      });
    } catch (error) {
      logger.error('Inline search failed', error);
      await ctx.answerInlineQuery([
        buildArticleResult('error', 'Search unavailable', 'Unable to perform inline search right now. Try again later.', 'Unable to perform inline search right now. Try again later.'),
      ], { cache_time: 10, is_personal: true });
    }
  });
}
