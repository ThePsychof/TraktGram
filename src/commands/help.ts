import type { Bot } from 'grammy';

// Register `/help` command — lists available commands.
export function registerHelp(bot: Bot) {
  bot.command('help', async (ctx) => {
    const msg = [
      '*Available commands:*',
      '/start - Open the TraktGram Mini App and quick companion actions',
      '/ping - Respond with pong',
      '/help - Show this help',
      '/login - Connect your Trakt account',
      '/me - Show your Trakt account info',
      '/trending - Show top trending items on Trakt',
      '',
      '*Inline mode:* Type `@TraktGram_Bot <movie or show>` anywhere to search Trakt instantly.',
      '*Note:* The bot is your lightweight companion. The Mini App is the primary Trakt experience.',
    ].join('\n');

    await ctx.reply(msg, { parse_mode: 'Markdown' });
  });
}
