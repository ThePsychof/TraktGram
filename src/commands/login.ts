import type { Bot } from 'grammy';
import logger from '../utils/logger';

const MINI_APP_URL = 'https://t.me/TraktGram_bot?startapp=login';

export function registerLogin(bot: Bot) {
  bot.command('login', async (ctx) => {
    try {
      await ctx.reply(
        '🔐 Connect your Trakt account\n\nTap the button below to choose how you want to sign in.',
        { reply_markup: { inline_keyboard: [[{ text: '🔐 Connect Trakt', url: MINI_APP_URL }]] } },
      );
    } catch (error) {
      logger.error('Error in login command', error);
      await ctx.reply('❌ An error occurred. Please try again later.');
    }
  });
}