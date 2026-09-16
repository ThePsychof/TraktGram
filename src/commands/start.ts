import type { Bot } from 'grammy';
import type { OAuthService } from '../services/oauth';
import type { TraktService } from '../services/trakt';
import { renderDetails } from '../ui/screens/details';
import { buildMainMenu } from '../ui/menus';

export function registerStart(
  bot: Bot,
  traktService: TraktService,
  oauthService?: OAuthService,
) {
  bot.command('start', async (ctx) => {
    const text = ctx.message?.text?.trim() ?? '';
    const parts = text.split(' ').filter(Boolean);
    const payload = parts[1];

    if (payload === 'connected') {
      await ctx.reply(
        '✅ Your Trakt account is connected.\n\nUse /me to view your profile, or /trending to browse what\'s hot.',
      );
      return;
    }

    if (payload === 'connect_failed') {
      await ctx.reply('❌ Trakt login failed or was cancelled.\n\nUse /login to try again.');
      return;
    }

    if (payload) {
      const [type, idPart] = payload.split('_');
      const id = Number(idPart);
      if ((type === 'movie' || type === 'show' || type === 'episode') && !Number.isNaN(id) && id > 0) {
        try {
          await renderDetails(ctx, traktService, oauthService, type, id);
          return;
        } catch (err) {
          console.error('Failed to render deep-linked item', err);
        }
      }
    }

    const isAuthenticated = ctx.from && oauthService
      ? Boolean(await oauthService.getValidAccessToken(ctx.from.id))
      : false;

    const welcomeText = [
      '🎬 <b>TraktGram</b>',
      '',
      'Your Trakt shortcut in Telegram.',
      '',
      '• /trending — what\'s hot right now',
      '• /me — your profile',
      '• /login — connect your Trakt account',
      '• /help — all commands',
      '',
      'Tip: type <code>@TraktGram_Bot</code> followed by a title in any chat for inline search.',
    ].join('\n');

    await ctx.reply(welcomeText, {
      parse_mode: 'HTML',
      reply_markup: buildMainMenu(isAuthenticated),
    });
  });
}