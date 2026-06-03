import type { Context } from 'grammy';
import type { InlineKeyboardMarkup } from '@grammyjs/types';
import { buildMainMenu } from '../menus';
import type { OAuthService } from '../../services/oauth';

export async function renderHome(ctx: Context, oauthService?: OAuthService) {
  const isAuthenticated = !!(ctx.from && oauthService && (await oauthService.getAuthenticatedUser(ctx.from.id)));
  const text = '📺 TraktGram — your Trakt home inside Telegram.\n\nUse the buttons below to access Continue Watching, Watchlist, History, Recommendations, Profile, and Search.';
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
