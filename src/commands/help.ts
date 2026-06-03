import type { Bot } from 'grammy';

// Register `/help` command — lists available commands.
export function registerHelp(bot: Bot) {
  bot.command('help', async (ctx) => {
    const msg = [
      '*Available commands:*',
      '/start - Open your Trakt home screen',
      '/ping - Respond with pong',
      '/help - Show this help',
      '/login - Connect your Trakt account',
      '/me - Show your Trakt account info',
      '/trending - Show top trending items on Trakt',
      '\n*Inline mode:* Type `@TraktGram_Bot <movie or show>` anywhere to search Trakt instantly. Search is a secondary tool; use the buttons on /start for your timeline.',
    ].join('\n');

    await ctx.reply(msg, { parse_mode: 'Markdown' });
  });
}
