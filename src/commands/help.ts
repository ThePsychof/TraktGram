import type { Bot } from 'grammy';

// Register `/help` command — lists available commands.
export function registerHelp(bot: Bot) {
  bot.command('help', async (ctx) => {
    const msg = [
      '*Available commands:*',
      '/start - Welcome message',
      '/ping - Respond with pong',
      '/help - Show this help',
      '/login - Connect your Trakt account',
      '/me - Show your Trakt account info',
      '/trending - Show top 5 trending movies from Trakt',
      '\n*Inline mode:* Type `@TraktGramBot <movie or show>` anywhere to search Trakt instantly.',
    ].join('\n');

    await ctx.reply(msg, { parse_mode: 'Markdown' });
  });
}
