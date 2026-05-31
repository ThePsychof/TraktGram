import type { Bot } from 'grammy';

// Register `/start` command. Sends a friendly welcome and short help.
export function registerStart(bot: Bot) {
  bot.command('start', async (ctx) => {
    await ctx.reply(
      'Welcome to Traktgram — your Trakt.tv companion.\nUse /help to see available commands.'
    );
  });
}
