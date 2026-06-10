import type { Context } from 'grammy';
import type { InlineKeyboardMarkup } from '@grammyjs/types';
import { buildMainMenu } from '../menus';
import type { OAuthService } from '../../services/oauth';

export async function renderHome(ctx: Context, oauthService?: OAuthService) {
  const isAuthenticated = !!(ctx.from && oauthService && (await oauthService.getAuthenticatedUser(ctx.from.id)));
  const text = '📺 TraktGram — your Telegram companion.\n\nOpen the Mini App for the full Trakt experience: Continue Watching, Watchlist, History, Calendar, Recommendations, and Profile.';
  const markup: InlineKeyboardMarkup = buildMainMenu(!!isAuthenticated);
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
