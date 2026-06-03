import type { Bot } from 'grammy';
import type { TraktService } from '../services/trakt';
import { renderSearchResults } from '../ui/screens/search';
import logger from '../utils/logger';

export function registerSearch(bot: Bot, traktService: TraktService) {
  // Handle /search command
  bot.command('search', async (ctx) => {
    try {
      const query = ctx.match?.trim() ?? '';
      
      if (!query || query.length < 2) {
        await ctx.reply('🔍 Usage: /search <movie or show title>\n\nExamples:\n/search Dune\n/search The Bear\n/search Inception');
        return;
      }

      logger.info('Search command initiated', { query });
      await renderSearchResults(ctx, traktService, {} as any, query, 0);
    } catch (error) {
      logger.error('Search command error', error);
      await ctx.reply('❌ Search failed. Please try again.');
    }
  });

  // Handle text messages as search queries in private chat
  bot.on('message:text', async (ctx) => {
    try {
      // Ignore commands
      if (ctx.message.text.startsWith('/')) return;

      // Only in private chats
      if (ctx.chat.type !== 'private') return;

      // Ignore if replying to someone else's message
      const isReplyToBot = ctx.message.reply_to_message?.from?.id === ctx.botInfo.id;
      if (ctx.message.reply_to_message && !isReplyToBot) return;

      const text = ctx.message.text.trim();
      
      // Only treat as search if it's a reasonable length and doesn't look like spam
      if (text.length < 2 || text.length > 100) return;
      
      // Ignore messages that look like general chat (multiple words with common words)
      const commonWords = ['is', 'the', 'a', 'and', 'or', 'but', 'how', 'what', 'why', 'please', 'thanks', 'ok'];
      const lowerText = text.toLowerCase();
      const wordCount = text.split(/\s+/).length;
      if (wordCount > 5 && commonWords.some(w => lowerText.includes(` ${w} `))) {
        return; // Looks like a conversation, not a search
      }

      logger.info('Text search initiated', { text });
      await renderSearchResults(ctx, traktService, {} as any, text, 0);
    } catch (error) {
      logger.error('Text search error', error);
      // Silently ignore to not spam user with non-search messages
    }
  });
}
