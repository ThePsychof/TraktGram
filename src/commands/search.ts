import type { Bot } from 'grammy';
import type { TraktService } from '../services/trakt';
import { renderSearchResults } from '../ui/screens/search';
import logger from '../utils/logger';

export function registerSearch(bot: Bot, traktService: TraktService) {
  // Handle /search command
  bot.command('search', async (ctx) => {
    const query = ctx.match?.trim();
    if (!query || query.length < 2) {
      await ctx.reply('Usage: /search <movie or show title>\n\nExample: /search Dune');
      return;
    }

    try {
      await renderSearchResults(ctx, traktService, {} as any, query, 0);
    } catch (error) {
      logger.error('Search command error', error);
      await ctx.reply('Failed to search. Try again later.');
    }
  });

  // Handle text messages as search queries in private chat
  bot.on('message:text', async (ctx) => {
    // Ignore commands
    if (ctx.message.text.startsWith('/')) return;

    // Only in private chats
    if (ctx.chat.type !== 'private') return;

    // Ignore messages that are too short or too long
    const text = ctx.message.text.trim();
    if (text.length < 2 || text.length > 100) return;

    // Ignore if replying to someone else's message or bot's own message
    const isReplyToBot = ctx.message.reply_to_message?.from?.id === ctx.botInfo.id;
    if (ctx.message.reply_to_message && !isReplyToBot) return;

    try {
      await renderSearchResults(ctx, traktService, {} as any, text, 0);
    } catch (error) {
      logger.error('Text search error', error);
      // Silently fail for non-search messages
    }
  });
}
