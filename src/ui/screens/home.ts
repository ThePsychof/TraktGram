import type { Context, InlineKeyboardMarkup } from 'grammy';
import { buildMainMenu } from '../menus';
import type { OAuthService } from '../../services/oauth';

export async function renderHome(ctx: Context, oauthService?: OAuthService) {
  const isAuthenticated = !!(ctx.from && oauthService && (await oauthService.getAuthenticatedUser(ctx.from.id)));
  const text = '🎬 TraktGram\nChoose an action below.';
  const markup: InlineKeyboardMarkup = buildMainMenu(!!isAuthenticated);
  // Use editMessageText when possible, otherwise reply
  try {
    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, { reply_markup: markup });
    } else {
      await ctx.reply(text, { reply_markup: markup });
    }
  } catch (err) {
    await ctx.reply(text, { reply_markup: markup });
  }
}
