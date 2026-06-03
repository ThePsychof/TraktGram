import type { Bot } from 'grammy';
import type {
  InlineKeyboardMarkup,
  InlineQueryResult,
  InlineQueryResultArticle,
  LinkPreviewOptions,
} from '@grammyjs/types';
import type { TraktSearchItem } from '../types/trakt';
import type { TraktService } from '../services/trakt';
import logger from '../utils/logger';
import {
  buildEmptyInlineResponse,
  buildInlineResultDescription,
  buildInlineResultTitle,
  buildMessageCaption,
  buildTraktReplyMarkup,
  escapeHtml,
  getPosterUrlFromItem,
} from '../utils/format';

function getResultId(item: TraktSearchItem, index: number): string {
  const ids = item.movie?.ids ?? item.show?.ids ?? {};
  const uniqueId = ids.trakt ?? ids.tmdb ?? item.movie?.title ?? item.show?.title ?? index;
  return `${item.type}-${uniqueId}`;
}

function buildLinkPreviewOptions(posterUrl?: string): LinkPreviewOptions {
  if (!posterUrl) {
    return { is_disabled: true };
  }

  return {
    url: posterUrl,
    prefer_large_media: true,
    show_above_text: true,
  };
}

function buildArticleResult(
  id: string,
  title: string,
  description: string,
  messageText: string,
  posterUrl?: string,
  replyMarkup?: InlineKeyboardMarkup
): InlineQueryResultArticle {
  return {
    type: 'article',
    id,
    title,
    description,
    thumbnail_url: posterUrl,
    thumbnail_width: 46,
    thumbnail_height: 69,
    input_message_content: {
      message_text: messageText,
      parse_mode: 'HTML',
      link_preview_options: buildLinkPreviewOptions(posterUrl),
    },
    reply_markup: replyMarkup,
  };
}

async function resolveInlineResult(
  item: TraktSearchItem,
  index: number,
  traktService: TraktService,
  botUsername: string
): Promise<InlineQueryResultArticle> {
  const id = getResultId(item, index);
  const meta = item.movie ?? item.show;
  const resultType = item.type === 'movie' || item.type === 'show' ? item.type : 'movie';
  const title = buildInlineResultTitle(item);
  const description = buildInlineResultDescription(item);
  const cast = await traktService.getCastForItem(item);
  const caption = buildMessageCaption(item, cast);
  const posterUrl = getPosterUrlFromItem(item);
  const traktId = meta?.ids?.trakt;

  const replyMarkup: InlineKeyboardMarkup = {
    inline_keyboard: [
      ...(buildTraktReplyMarkup(resultType, meta?.ids).inline_keyboard ?? []),
      ...(traktId
        ? [[{ text: '⚡ Manage in TraktGram', url: `https://t.me/${botUsername}?start=${resultType}_${traktId}` }]]
        : []),
    ],
  };

  return buildArticleResult(id, title, description, caption, posterUrl, replyMarkup);
}

export function registerInlineQuery(
  bot: Bot,
  traktService: TraktService
) {
  bot.on('inline_query', async (ctx) => {
    const query = ctx.inlineQuery.query?.trim() ?? '';
    const botUsername = String((ctx as any).botInfo?.username ?? 'TraktGram_Bot');
    const results: InlineQueryResult[] = [];

    if (!query) {
      try {
        const trending = await traktService.getTrendingMovies(8);
        for (const [index, item] of trending.entries()) {
          const searchItem: TraktSearchItem = { type: 'movie', movie: item.movie };
          const result = await resolveInlineResult(searchItem, index, traktService, botUsername);
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
        const result = await resolveInlineResult(item, index, traktService, botUsername);
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
