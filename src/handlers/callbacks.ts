import type { Bot } from 'grammy';
import type { TraktService } from '../services/trakt';
import type { OAuthService } from '../services/oauth';
import { renderHome } from '../ui/screens/home';
import { renderContinueWatching } from '../ui/screens/continueWatching';
import { renderWatchlist } from '../ui/screens/watchlist';
import { renderDetails } from '../ui/screens/details';
import { renderHistory } from '../ui/screens/history';
import { renderAccount } from '../ui/screens/account';
import { renderRecommendations } from '../ui/screens/recommendations';
import logger from '../utils/logger';
import { decodeCallback, encodeCallback } from '../utils/callbackData';

export function registerCallbackHandlers(bot: Bot, traktService: TraktService, oauthService?: OAuthService) {
  bot.callbackQuery('a:home', async (ctx) => {
    try {
      await renderHome(ctx, oauthService);
      await ctx.answerCallbackQuery();
    } catch (err) {
      logger.error('home callback error', err);
    }
  });

  // Legacy direct mapping for continue/watchlist actions
  bot.callbackQuery('a:continue', async (ctx) => {
    try {
      if (!oauthService) {
        await ctx.answerCallbackQuery({ text: 'OAuth not configured', show_alert: true });
        return;
      }
      await renderContinueWatching(ctx, traktService, oauthService);
      await ctx.answerCallbackQuery();
    } catch (err) {
      logger.error('continue callback error', err);
    }
  });

  bot.callbackQuery('a:watchlist', async (ctx) => {
    try {
      if (!oauthService) {
        await ctx.answerCallbackQuery({ text: 'OAuth not configured', show_alert: true });
        return;
      }
      await renderWatchlist(ctx, traktService, oauthService);
      await ctx.answerCallbackQuery();
    } catch (err) {
      logger.error('watchlist callback error', err);
    }
  });

  // Generic decoded callback handler
  bot.on('callback_query:data', async (ctx) => {
    try {
      const data = ctx.callbackQuery.data || '';
      const parsed = decodeCallback(data);
      const action = parsed.action;
      const params = parsed.params;

      if (action === 'continue') {
        const page = Number(params.page || '1');
        await renderContinueWatching(ctx, traktService, oauthService as any, page);
        await ctx.answerCallbackQuery();
        return;
      }

      if (action === 'watchlist') {
        const page = Number(params.page || '1');
        await renderWatchlist(ctx, traktService, oauthService as any, page);
        await ctx.answerCallbackQuery();
        return;
      }

      if (action === 'details') {
        const t = params.t;
        const id = Number(params.id);
        if (t && id) await renderDetails(ctx, traktService, oauthService as any, t, id);
        await ctx.answerCallbackQuery();
        return;
      }

      if (action === 'history') {
        const page = Number(params.page || '1');
        await renderHistory(ctx, traktService, oauthService as any, page);
        await ctx.answerCallbackQuery();
        return;
      }

      if (action === 'account') {
        if (!oauthService) { await ctx.answerCallbackQuery({ text: 'OAuth not configured', show_alert: true }); return; }
        await renderAccount(ctx, oauthService as any, traktService);
        await ctx.answerCallbackQuery();
        return;
      }

      if (action === 'recommendations') {
        const page = Number(params.page || '1');
        await renderRecommendations(ctx, traktService, oauthService as any, page);
        await ctx.answerCallbackQuery();
        return;
      }

      if (action === 'markwatched') {
        // present choices: Watched Now
        const confirmCb = encodeCallback('markwatched_now', { t: params.t, id: params.id });
        await ctx.editMessageReplyMarkup({ inline_keyboard: [[{ text: '✅ Watched Now', callback_data: confirmCb }], [{ text: '🏠 Home', callback_data: encodeCallback('home') }]] });
        await ctx.answerCallbackQuery();
        return;
      }

      if (action === 'markwatched_now') {
        if (!oauthService || !ctx.from) {
          await ctx.answerCallbackQuery({ text: 'Not authenticated', show_alert: true });
          return;
        }
        const accessToken = await oauthService.getValidAccessToken(ctx.from.id);
        if (!accessToken) {
          await ctx.answerCallbackQuery({ text: 'Please connect Trakt first', show_alert: true });
          return;
        }

        // Build payload according to type
        const t = params.t;
        const id = params.id;
        const payload: any = {};
        if (t === 'movie') {
          payload.movies = [{ ids: { trakt: Number(id) } }];
        } else if (t === 'show') {
          // Marking a show as watched via history is typically by episodes; here we mark the show itself if needed
          payload.shows = [{ ids: { trakt: Number(id) } }];
        } else if (t === 'episode') {
          payload.episodes = [{ ids: { trakt: Number(id) } }];
        }

        try {
          await traktService.addHistoryEntry(accessToken, payload);
          await ctx.answerCallbackQuery({ text: '✅ Watched saved', show_alert: false });
        } catch (err) {
          logger.error('Failed adding history entry', err);
          await ctx.answerCallbackQuery({ text: 'Failed to mark watched', show_alert: true });
        }
        return;
      }

      if (action === 'watching_now') {
        if (!oauthService || !ctx.from) {
          await ctx.answerCallbackQuery({ text: 'Not authenticated', show_alert: true });
          return;
        }
        const accessToken = await oauthService.getValidAccessToken(ctx.from.id);
        if (!accessToken) {
          await ctx.answerCallbackQuery({ text: 'Please connect Trakt first', show_alert: true });
          return;
        }
        const t = params.t;
        const id = params.id;
        const payload: any = {};
        if (t === 'movie') payload.movie = { ids: { trakt: Number(id) } };
        else if (t === 'episode') payload.episode = { ids: { trakt: Number(id) } };
        else if (t === 'show') payload.show = { ids: { trakt: Number(id) } };

        try {
          await traktService.createCheckin(accessToken, payload);
          await ctx.answerCallbackQuery({ text: '📺 Now watching', show_alert: false });
        } catch (err) {
          logger.error('Failed creating checkin', err);
          await ctx.answerCallbackQuery({ text: 'Failed to start check-in', show_alert: true });
        }
        return;
      }

      if (action === 'remove_watchlist' || action === 'add_watchlist') {
        if (!oauthService || !ctx.from) {
          await ctx.answerCallbackQuery({ text: 'Not authenticated', show_alert: true });
          return;
        }
        const accessToken = await oauthService.getValidAccessToken(ctx.from.id);
        if (!accessToken) {
          await ctx.answerCallbackQuery({ text: 'Please connect Trakt first', show_alert: true });
          return;
        }

        const t = params.t;
        const id = Number(params.id);
        const payload: any = {};
        if (t === 'movie') payload.movies = [{ ids: { trakt: id } }];
        else if (t === 'show') payload.shows = [{ ids: { trakt: id } }];

        try {
          if (action === 'add_watchlist') {
            await traktService.addToWatchlist(accessToken, payload);
            await ctx.answerCallbackQuery({ text: '➕ Added to watchlist', show_alert: false });
          } else {
            await traktService.removeFromWatchlist(accessToken, payload);
            await ctx.answerCallbackQuery({ text: '❌ Removed from watchlist', show_alert: false });
          }
        } catch (err) {
          logger.error('Failed updating watchlist', err);
          await ctx.answerCallbackQuery({ text: 'Failed to update watchlist', show_alert: true });
        }
        return;
      }

      if (action === 'rate') {
        if (!oauthService || !ctx.from) { await ctx.answerCallbackQuery({ text: 'Not authenticated', show_alert: true }); return; }
        const accessToken = await oauthService.getValidAccessToken(ctx.from.id);
        if (!accessToken) { await ctx.answerCallbackQuery({ text: 'Please connect Trakt first', show_alert: true }); return; }
        const value = Number(params.v);
        const t = params.t;
        const id = Number(params.id);
        const payload: any = {};
        if (t === 'movie') payload.movies = [{ ids: { trakt: id }, rating: value }];
        else if (t === 'show') payload.shows = [{ ids: { trakt: id }, rating: value }];
        try {
          await traktService.rateItem(accessToken, payload);
          await ctx.answerCallbackQuery({ text: `⭐ Rating ${value} saved`, show_alert: false });
        } catch (err) {
          logger.error('Failed saving rating', err);
          await ctx.answerCallbackQuery({ text: 'Failed to save rating', show_alert: true });
        }
        return;
      }

      if (action === 'logout') {
        if (!oauthService || !ctx.from) { await ctx.answerCallbackQuery({ text: 'Not authenticated', show_alert: true }); return; }
        try { await oauthService.logout(ctx.from.id); await ctx.answerCallbackQuery({ text: 'Logged out', show_alert: false }); await renderHome(ctx, oauthService); } catch (err) { logger.error('logout error', err); await ctx.answerCallbackQuery({ text: 'Logout failed', show_alert: true }); }
        return;
      }

      // Unknown action -> simple notice
      await ctx.answerCallbackQuery({ text: 'Action not implemented yet', show_alert: false });
    } catch (err) {
      logger.error('callback fallback error', err);
    }
  });
}
