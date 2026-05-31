import type { Bot } from 'grammy';

// Register `/ping` command — trivial health-check.
export function registerPing(bot: Bot) {
  bot.command('ping', async (ctx) => {
    await ctx.reply('pong');
  });
}
