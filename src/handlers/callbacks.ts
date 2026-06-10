import type { Bot, Context } from 'grammy';
import type { TraktService } from '../services/trakt';
import type { OAuthService } from '../services/oauth';
import { renderDetails } from '../ui/screens/details';
import { buildManagementKeyboard, buildRatingKeyboard } from '../ui/menus';
import logger from '../utils/logger';
import { decodeCallback, encodeCallback } from '../utils/callbackData';

export function registerCallbackHandlers(bot: Bot, traktService: TraktService, oauthService?: OAuthService, miniAppUrl?: string) {
  const promptMiniApp = async (ctx: Context, note: string) => {
    const message = miniAppUrl
      ? `${note}\n\nOpen the TraktGram Mini App here:\n${miniAppUrl}`
      : `${note}\n\nUse /start to open the TraktGram Mini App.`;
    try {
      await ctx.reply(message);
    } catch {
      await ctx.answerCallbackQuery({ text: miniAppUrl ? 'Open the Mini App from the chat.' : 'Use /start to open the Mini App.', show_alert: true });
    }
  };

  bot.callbackQuery('a:home', async (ctx) => {
    try {
      await promptMiniApp(ctx, 'Open the TraktGram Mini App for the full experience.');
      await ctx.answerCallbackQuery();
    } catch (err) {
      logger.error('home callback error', err);
    }
  });

  bot.callbackQuery('a:continue', async (ctx) => {
    try {
      await promptMiniApp(ctx, 'Continue Watching is available in the Mini App.');
      await ctx.answerCallbackQuery();
    } catch (err) {
      logger.error('continue callback error', err);
    }
  });

  bot.callbackQuery('a:watchlist', async (ctx) => {
    try {
      await promptMiniApp(ctx, 'Watchlist access is available in the Mini App.');
      await ctx.answerCallbackQuery();
    } catch (err) {
      logger.error('watchlist callback error', err);
    }
  });

  bot.callbackQuery('a:calendar', async (ctx) => {
    try {
      await promptMiniApp(ctx, 'Calendar and upcoming episodes are available in the Mini App.');
      await ctx.answerCallbackQuery();
    } catch (err) {
      logger.error('calendar callback error', err);
    }
  });

  bot.callbackQuery('a:account', async (ctx) => {
    try {
      await promptMiniApp(ctx, 'Your Trakt profile is best viewed in the Mini App.');
      await ctx.answerCallbackQuery();
    } catch (err) {
      logger.error('account callback error', err);
    }
  });


  bot.on('callback_query:data', async (ctx) => {
    try {
      const data = ctx.callbackQuery.data || '';
      const parsed = decodeCallback(data);
      const action = parsed.action;
      const params = parsed.params;

      if (action === 'continue') {
        await promptMiniApp(ctx, 'Continue Watching is available in the Mini App.');
        await ctx.answerCallbackQuery();
        return;
      }

      if (action === 'watchlist') {
        await promptMiniApp(ctx, 'Watchlist access is available in the Mini App.');
        await ctx.answerCallbackQuery();
        return;
      }

      if (action === 'collection') {
        await promptMiniApp(ctx, 'Your collection is available in the Mini App.');
        await ctx.answerCallbackQuery();
        return;
      }

      if (action === 'calendar') {
        await promptMiniApp(ctx, 'Calendar and upcoming episodes are available in the Mini App.');
        await ctx.answerCallbackQuery();
        return;
      }

      if (action === 'home') {
        await promptMiniApp(ctx, 'Open the TraktGram Mini App for the full experience.');
        await ctx.answerCallbackQuery();
        return;
      }

      if (action === 'trending') {
        try {
          const items = await traktService.getTrendingMovies(5);
          if (!items || items.length === 0) { await ctx.answerCallbackQuery({ text: 'No trending items', show_alert: false }); return; }
          const lines = items.map((it:any,i:number) => `${i+1}. ${it.movie?.title ?? 'Unknown'} (${it.movie?.year ?? 'N/A'})`);
          await ctx.reply(`Top trending:\n\n${lines.join('\n')}`);
          await ctx.answerCallbackQuery();
        } catch (err) { logger.error('trending error', err); await ctx.answerCallbackQuery({ text: 'Failed to fetch trending', show_alert: true }); }
        return;
      }

      if (action === 'connect') {
          if (!oauthService) { await ctx.answerCallbackQuery({ text: 'OAuth not configured', show_alert: true }); return; }
        if (!ctx.from) { await ctx.answerCallbackQuery({ text: 'Unable to determine user', show_alert: true }); return; }
        try {
            const url = await oauthService.generateAuthorizationUrl(ctx.from.id);
          await ctx.reply(`Connect your Trakt account: ${url}`);
          await ctx.answerCallbackQuery();
        } catch (err) {
          logger.error('connect url error', err);
          await ctx.answerCallbackQuery({ text: 'Failed to start OAuth', show_alert: true });
        }
        return;
      }

      if (action === 'search') {
        await ctx.reply('🔍 Use inline search:\n\nType @TraktGram_Bot followed by a movie or show title in ANY chat.\n\nExamples:\n@TraktGram_Bot Dune\n@TraktGram_Bot The Bear\n\nResults will appear as cards below!');
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
        await promptMiniApp(ctx, 'History is available in the Mini App.');
        await ctx.answerCallbackQuery();
        return;
      }

      if (action === 'account') {
        await promptMiniApp(ctx, 'Your Trakt profile is best viewed in the Mini App.');
        await ctx.answerCallbackQuery();
        return;
      }

      if (action === 'recommendations') {
        await promptMiniApp(ctx, 'Recommendations are available in the Mini App.');
        await ctx.answerCallbackQuery();
        return;
      }

      if (action === 'markwatched') {
        // present choices: Watched Now
        const confirmCb = encodeCallback('markwatched_now', { t: params.t, id: params.id });
        await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [[{ text: '✅ Watched Now', callback_data: confirmCb }], [{ text: '🏠 Home', callback_data: encodeCallback('home') }]] } });
        await ctx.answerCallbackQuery();
        return;
      }

      if (action === 'rate_prompt') {
        const keyboard = buildRatingKeyboard('rate', { t: params.t, id: params.id });
        await ctx.editMessageReplyMarkup({ reply_markup: keyboard });
        await ctx.answerCallbackQuery();
        return;
      }

      if (action === 'similar') {
        await promptMiniApp(ctx, 'Similar item recommendations are available in the Mini App.');
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

          try {
            const updatedKeyboard = buildManagementKeyboard({
              type: t,
              id,
              inWatchlist: action === 'add_watchlist',
            });
            await ctx.editMessageReplyMarkup({ reply_markup: updatedKeyboard });
          } catch {
            // ignore if edit fails
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
        try {
          await oauthService.logout(ctx.from.id);
          await ctx.answerCallbackQuery({ text: 'Logged out', show_alert: false });
          await ctx.reply('Logged out. Open the Mini App to continue.');
        } catch (err) {
          logger.error('logout error', err);
          await ctx.answerCallbackQuery({ text: 'Logout failed', show_alert: true });
        }
        return;
      }

      // Unknown action -> simple notice
      await ctx.answerCallbackQuery({ text: 'Action not implemented yet', show_alert: false });
    } catch (err) {
      logger.error('callback fallback error', err);
    }
  });
}
