import type { Bot } from 'grammy';
import type {
  InlineQueryResult,
  InlineQueryResultArticle,
  InlineQueryResultPhoto,
} from '@grammyjs/types';
import type { TraktSearchItem } from '../types/trakt';
import type { TraktService } from '../services/trakt';
import type { TmdbService } from '../services/tmdb';
import logger from '../utils/logger';
import {
  buildEmptyInlineResponse,
  buildMessageCaption,
  buildResultDescription,
  escapeHtml,
  formatYear,
} from '../utils/format';

function getResultId(item: TraktSearchItem, index: number): string {
  const ids = item.movie?.ids ?? item.show?.ids ?? {};
  const uniqueId = ids.trakt ?? ids.tmdb ?? ids.imdb ?? item.movie?.title ?? item.show?.title ?? index;
  return `${item.type}-${uniqueId}`;
}

function getItemYear(item: TraktSearchItem): string | number | undefined {
  const meta = item.movie ?? item.show;
  if (!meta) return undefined;
  if ('first_aired' in meta && meta.first_aired) {
    return meta.first_aired.slice(0, 4);
  }
  if (meta.release_date) {
    return meta.release_date.slice(0, 4);
  }
  return meta.year;
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
  tmdb: TmdbService
) {
  const id = getResultId(item, index);
  const meta = item.movie ?? item.show;
  const title = meta?.title ?? meta?.name ?? 'Untitled';
  const year = formatYear(getItemYear(item));
  const description = buildResultDescription(item);
  const details = await tmdb.findDetailsByTraktIds(meta?.ids, item.type as 'movie' | 'show');
  const caption = buildMessageCaption(item, details ?? undefined);
  const posterUrl = await tmdb.getPosterUrlForTraktItem(meta?.ids, item.type as 'movie' | 'show');

  if (posterUrl) {
    return buildPhotoResult(id, title, description, posterUrl, caption);
  }

  return buildArticleResult(id, title, description, caption, undefined);
}

export function registerInlineQuery(
  bot: Bot,
  traktService: TraktService,
  tmdbService: TmdbService
) {
  bot.on('inline_query', async (ctx) => {
    const query = ctx.inlineQuery.query?.trim() ?? '';
    const results: InlineQueryResult[] = [];

    if (!query) {
      try {
        const trending = await traktService.getTrendingMovies(8);
        for (const [index, item] of trending.entries()) {
          const title = item.movie?.title ?? 'Untitled';
          const year = formatYear(item.movie?.year);
          const description = `${title} · ${year} · ${item.watchers?.toLocaleString() ?? 'N/A'} watchers`;
          const caption = `<b>🎬 ${escapeHtml(title)}</b> <i>(${year})</i>\n<b>Watchers:</b> ${item.watchers?.toLocaleString() ?? 'N/A'}\n<b>Powered by TraktGram</b>`;
          const photoUrl = await tmdbService.getPosterUrlForTraktItem(item.movie?.ids, 'movie');
          const resultId = `trending-${item.movie?.ids?.trakt ?? index}`;

          if (photoUrl) {
            results.push({
              type: 'photo',
              id: resultId,
              photo_url: photoUrl,
              thumbnail_url: photoUrl,
              title,
              description,
              caption,
              parse_mode: 'HTML',
              show_caption_above_media: true,
            });
          } else {
            results.push({
              type: 'article',
              id: resultId,
              title,
              description,
              input_message_content: {
                message_text: caption,
                parse_mode: 'HTML',
              },
            });
          }
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
        const result = await resolveInlineResult(item, index, tmdbService);
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
