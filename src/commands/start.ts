import type { Bot } from 'grammy';
import type { OAuthService } from '../services/oauth';
import type { TraktService } from '../services/trakt';
import { buildMainMenu } from '../ui/menus';
import { renderDetails } from '../ui/screens/details';

// Register `/start` command and present main menu or deep-linked item.
export function registerStart(bot: Bot, traktService: TraktService, oauthService?: OAuthService) {
  bot.command('start', async (ctx) => {
    const text = ctx.message?.text?.trim() ?? '';
    const parts = text.split(' ').filter(Boolean);
    const payload = parts[1];

    if (payload) {
      const [type, idPart] = payload.split('_');
      const id = Number(idPart);
      if ((type === 'movie' || type === 'show') && !Number.isNaN(id) && id > 0) {
        try {
          await renderDetails(ctx, traktService, oauthService as any, type, id);
          return;
        } catch (err) {
          // If rendering fails, fall back to main menu
          console.error('Failed to render deep-linked item', err);
        }
      }
    }

    const isAuthenticated = !!(ctx.from && oauthService && (await oauthService.getAuthenticatedUser(ctx.from.id)));
    await ctx.reply('🎬 TraktGram', { reply_markup: buildMainMenu(!!isAuthenticated) });
  });
}
