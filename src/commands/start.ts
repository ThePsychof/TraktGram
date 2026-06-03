import type { Bot } from 'grammy';
import { buildMainMenu } from '../ui/menus';
import type { OAuthService } from '../services/oauth';

// Register `/start` command and present main menu.
export function registerStart(bot: Bot, oauthService?: OAuthService) {
  bot.command('start', async (ctx) => {
    const isAuthenticated = !!(ctx.from && oauthService && (await oauthService.getAuthenticatedUser(ctx.from.id)));
    await ctx.reply('🎬 TraktGram', { reply_markup: buildMainMenu(!!isAuthenticated) });
  });
}
