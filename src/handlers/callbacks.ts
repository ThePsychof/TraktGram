import type { Bot } from 'grammy';
import type { TraktService } from '../services/trakt';
import type { OAuthService } from '../services/oauth';
import { renderDetails } from '../ui/screens/details';
import { buildRatingKeyboard } from '../ui/menus';
import logger from '../utils/logger';
import { decodeCallback, encodeCallback } from '../utils/callbackData';

export function registerCallbackHandlers(
  bot: Bot,
  traktService: TraktService,
  oauthService?: OAuthService,
) {
  bot.on('callback_query:data', async (ctx) => {
    try {
      const data = ctx.callbackQuery.data || '';
      const parsed = decodeCallback(data);
      const action = parsed.action;
      const params = parsed.params;

      if (action === 'trending') {
        try {
          const [movies, shows] = await Promise.all([
            traktService.getTrendingMovies(5).catch(() => []),
            traktService.getTrendingShows(5).catch(() => []),
          ]);

          const rows: any[] = [];

          for (const it of movies as any[]) {
            const id = it.movie?.ids?.trakt;
            if (!id) continue;
            const title = (it.movie?.title ?? 'Unknown').slice(0, 45);
            const year = it.movie?.year ?? '';
            rows.push([
              {
                text: `🎬 ${title}${year ? ` (${year})` : ''}`.slice(0, 60),
                callback_data: encodeCallback('details', { t: 'movie', id, from: 'trending' }),
              },
            ]);
          }

          for (const it of shows as any[]) {
            const id = it.show?.ids?.trakt;
            if (!id) continue;
            const title = (it.show?.title ?? 'Unknown').slice(0, 45);
            const year = it.show?.year ?? '';
            rows.push([
              {
                text: `📺 ${title}${year ? ` (${year})` : ''}`.slice(0, 60),
                callback_data: encodeCallback('details', { t: 'show', id, from: 'trending' }),
              },
            ]);
          }

          if (rows.length === 0) {
            await ctx.answerCallbackQuery({ text: 'No trending items', show_alert: false });
            return;
          }

          rows.push([{ text: '🏠 Home', callback_data: encodeCallback('home') }]);

          await ctx.reply('🔥 Trending on Trakt\n\nTap any item to see details:', {
            reply_markup: { inline_keyboard: rows },
          });
          await ctx.answerCallbackQuery();
        } catch (err) {
          logger.error('trending error', err);
          await ctx.answerCallbackQuery({ text: 'Failed to fetch trending', show_alert: true });
        }
        return;
      }

      if (action === 'connect') {
        if (!oauthService) {
          await ctx.answerCallbackQuery({ text: 'OAuth not configured', show_alert: true });
          return;
        }
        if (!ctx.from) {
          await ctx.answerCallbackQuery({ text: 'Unable to determine user', show_alert: true });
          return;
        }
        try {
          const state = await oauthService.createOAuthState(ctx.from.id);
          const base = oauthService.getBaseUrl();
          const pageUrl = `${base}/auth/start?state=${encodeURIComponent(state)}`;
          const { InlineKeyboard } = await import('grammy');
          const keyboard = new InlineKeyboard().url('🔐 Connect Trakt', pageUrl);
          await ctx.reply(
            '🔐 Connect your Trakt account\n\nTap the button below to choose how you want to sign in.',
            { reply_markup: keyboard },
          );
          await ctx.answerCallbackQuery();
        } catch (err) {
          logger.error('connect url error', err);
          await ctx.answerCallbackQuery({ text: 'Failed to start OAuth', show_alert: true });
        }
        return;
      }

      if (action === 'search') {
        await ctx.reply(
          '🔍 Inline search:\n\nType @TraktGram_Bot followed by a movie or show title in any chat.\n\nExamples:\n@TraktGram_Bot Dune\n@TraktGram_Bot The Bear',
        );
        await ctx.answerCallbackQuery();
        return;
      }

      if (action === 'account') {
        if (!oauthService || !ctx.from) {
          await ctx.answerCallbackQuery({ text: 'Not authenticated', show_alert: true });
          return;
        }
        const userData = await oauthService.getAuthenticatedUser(ctx.from.id);
        if (!userData) {
          await ctx.reply('❌ No Trakt account connected. Use /login to connect.');
          await ctx.answerCallbackQuery();
          return;
        }
        const username = userData.username || 'Unknown';
        await ctx.reply(`👤 You are connected as *${username}*.`, {
          parse_mode: 'Markdown',
        });
        await ctx.answerCallbackQuery();
        return;
      }

      if (action === 'details') {
        const t = params.t;
        const id = Number(params.id);
        const from = params.from;
        const sid = params.sid ? Number(params.sid) : undefined;
        const sn = params.sn ? Number(params.sn) : undefined;
        if (t && id) {
          await renderDetails(ctx, traktService, oauthService, t, id, { from, sid, sn });
        }
        await ctx.answerCallbackQuery();
        return;
      }

      if (action === 'markwatched') {
        const confirmCb = encodeCallback('markwatched_now', { t: params.t, id: params.id });
        await ctx.editMessageReplyMarkup({
          reply_markup: {
            inline_keyboard: [
              [{ text: '✅ Watched Now', callback_data: confirmCb }],
              [{ text: '🏠 Home', callback_data: encodeCallback('home') }],
            ],
          },
        });
        await ctx.answerCallbackQuery();
        return;
      }

      if (action === 'rate_prompt') {
        const keyboard = buildRatingKeyboard('rate', { t: params.t, id: params.id });
        await ctx.editMessageReplyMarkup({ reply_markup: keyboard });
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

        const t = params.t;
        const id = params.id;
        const payload: any = {};
        if (t === 'movie') {
          payload.movies = [{ ids: { trakt: Number(id) } }];
        } else if (t === 'show') {
          payload.shows = [{ ids: { trakt: Number(id) } }];
        } else if (t === 'episode') {
          payload.episodes = [{ ids: { trakt: Number(id) } }];
        }

        try {
          await traktService.addHistoryEntry(accessToken, payload);
          await ctx.answerCallbackQuery({ text: '✅ Watched saved' });
          if (t && id) {
            try {
              await renderDetails(ctx, traktService, oauthService, String(t), Number(id));
            } catch (e) {
              logger.warn('Failed to refresh detail after mark', e);
            }
          }
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
          await ctx.answerCallbackQuery({ text: '📺 Now watching' });
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
            await ctx.answerCallbackQuery({ text: '➕ Added to watchlist' });
          } else {
            await traktService.removeFromWatchlist(accessToken, payload);
            await ctx.answerCallbackQuery({ text: '❌ Removed from watchlist' });
          }
        } catch (err) {
          logger.error('Failed updating watchlist', err);
          await ctx.answerCallbackQuery({ text: 'Failed to update watchlist', show_alert: true });
        }
        return;
      }

      if (action === 'rate') {
        if (!oauthService || !ctx.from) {
          await ctx.answerCallbackQuery({ text: 'Not authenticated', show_alert: true });
          return;
        }
        const accessToken = await oauthService.getValidAccessToken(ctx.from.id);
        if (!accessToken) {
          await ctx.answerCallbackQuery({ text: 'Please connect Trakt first', show_alert: true });
          return;
        }
        const value = Number(params.v);
        const t = params.t;
        const id = Number(params.id);
        const payload: any = {};
        if (t === 'movie') payload.movies = [{ ids: { trakt: id }, rating: value }];
        else if (t === 'show') payload.shows = [{ ids: { trakt: id }, rating: value }];
        else if (t === 'episode') payload.episodes = [{ ids: { trakt: id }, rating: value }];
        else {
          await ctx.answerCallbackQuery({ text: 'Unknown item type', show_alert: true });
          return;
        }
        try {
          await traktService.rateItem(accessToken, payload);
          const stars = (value / 2).toFixed(1).replace(/\.0$/, '');
          await ctx.answerCallbackQuery({ text: `⭐ Rated ${stars} / 5` });
          if (t && id) {
            try {
              await renderDetails(ctx, traktService, oauthService, t, id);
            } catch (e) {
              logger.warn('Failed to refresh detail after rate', e);
            }
          }
        } catch (err) {
          logger.error('Failed saving rating', err);
          await ctx.answerCallbackQuery({ text: 'Failed to save rating', show_alert: true });
        }
        return;
      }

      if (action === 'logout') {
        if (!oauthService || !ctx.from) {
          await ctx.answerCallbackQuery({ text: 'Not authenticated', show_alert: true });
          return;
        }
        try {
          await oauthService.logout(ctx.from.id);
          await ctx.answerCallbackQuery({ text: 'Logged out' });
          await ctx.reply('Logged out. Use /login to reconnect.');
        } catch (err) {
          logger.error('logout error', err);
          await ctx.answerCallbackQuery({ text: 'Logout failed', show_alert: true });
        }
        return;
      }

      if (action === 'home') {
        const isAuthed = ctx.from && oauthService
          ? Boolean(await oauthService.getValidAccessToken(ctx.from.id))
          : false;
        const { respondWith } = await import('../ui/navigate');
        const { buildMainMenu } = await import('../ui/menus');
        await respondWith(ctx, {
          text: [
            '🎬 <b>TraktGram</b>',
            '',
            'Your Trakt shortcut in Telegram.',
            '',
            '• /trending — what\'s hot right now',
            '• /me — your profile',
            '• /stats — watch time',
            '• /random — pick from your watchlist',
            '• /help — all commands',
          ].join('\n'),
          parse_mode: 'HTML',
          reply_markup: buildMainMenu(isAuthed),
        });
        await ctx.answerCallbackQuery();
        return;
      }

      if (action === 'seasons') {
        const showId = Number(params.id);
        if (!showId) {
          await ctx.answerCallbackQuery({ text: 'Invalid show id', show_alert: true });
          return;
        }
        const { renderSeasons } = await import('../ui/screens/seasons');
        await renderSeasons(ctx, traktService, oauthService, showId);
        await ctx.answerCallbackQuery();
        return;
      }

      if (action === 'season') {
        const showId = Number(params.id);
        const seasonNumber = Number(params.s);
        if (!showId || Number.isNaN(seasonNumber)) {
          await ctx.answerCallbackQuery({ text: 'Invalid season', show_alert: true });
          return;
        }
        const { renderEpisodes } = await import('../ui/screens/episodes');
        await renderEpisodes(ctx, traktService, oauthService, showId, seasonNumber);
        await ctx.answerCallbackQuery();
        return;
      }

      if (action === 'next_ep') {
        const showId = Number(params.id);
        if (!showId || !oauthService || !ctx.from) {
          await ctx.answerCallbackQuery({ text: 'Cannot fetch next episode', show_alert: true });
          return;
        }
        const token = await oauthService.getValidAccessToken(ctx.from.id);
        if (!token) {
          await ctx.answerCallbackQuery({ text: 'Please connect Trakt first', show_alert: true });
          return;
        }
        try {
          const progress = await traktService.getShowProgress(token, showId);
          const nextEp = progress?.next_episode;
          if (!nextEp?.ids?.trakt) {
            await ctx.answerCallbackQuery({ text: 'No next episode available', show_alert: true });
            return;
          }
          await renderDetails(ctx, traktService, oauthService, 'episode', nextEp.ids.trakt);
          await ctx.answerCallbackQuery();
        } catch (err) {
          logger.error('next_ep error', err);
          await ctx.answerCallbackQuery({ text: 'Failed to load next episode', show_alert: true });
        }
        return;
      }

      if (action === 'markwatched_again') {
        if (!oauthService || !ctx.from) {
          await ctx.answerCallbackQuery({ text: 'Not authenticated', show_alert: true });
          return;
        }
        const t = params.t as string;
        const id = Number(params.id);
        if (!t || !id || Number.isNaN(id)) {
          await ctx.answerCallbackQuery({ text: 'Invalid item', show_alert: true });
          return;
        }
        try {
          await oauthService.setPendingWatchTime(ctx.from.id, { type: t, id });
        } catch (err) {
          logger.error('Failed to set pending watch time', err);
          await ctx.answerCallbackQuery({ text: 'Failed to start. Try again.', show_alert: true });
          return;
        }
        await ctx.reply(
          '📅 When did you watch this?\n\nSend a date like:\n• `2024-08-15`\n• `yesterday`\n• `2 days ago`\n• `yesterday 8pm`\n\nSend /cancel to abort.',
          { parse_mode: 'Markdown' },
        );
        await ctx.answerCallbackQuery();
        return;
      }

      if (action === 'markwatched_unknown') {
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
        if (t === 'movie') {
          payload.movies = [{ ids: { trakt: Number(id) }, watched_at: 'unknown' }];
        } else if (t === 'show') {
          payload.shows = [{ ids: { trakt: Number(id) }, watched_at: 'unknown' }];
        } else if (t === 'episode') {
          payload.episodes = [{ ids: { trakt: Number(id) }, watched_at: 'unknown' }];
        }
        try {
          await traktService.addHistoryEntry(accessToken, payload);
          await ctx.answerCallbackQuery({ text: '❓ Marked with unknown date' });
        } catch (err) {
          logger.error('Failed adding unknown play', err);
          await ctx.answerCallbackQuery({ text: 'Failed to mark', show_alert: true });
        }
        return;
      }

      if (action === 'watch_again') {
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
        if (t !== 'show') {
          await ctx.answerCallbackQuery({ text: 'Watch Again is only for shows', show_alert: true });
          return;
        }
        try {
          await traktService.resetShowProgress(accessToken, id);
          await ctx.answerCallbackQuery({ text: '🔁 Progress reset. Start from S01E01.', show_alert: true });
        } catch (err) {
          logger.error('Failed to reset progress', err);
          await ctx.answerCallbackQuery({ text: 'Failed to reset progress', show_alert: true });
        }
        return;
      }

      if (action === 'stats') {
        if (!oauthService || !ctx.from) {
          await ctx.answerCallbackQuery({ text: 'Not authenticated', show_alert: true });
          return;
        }
        const accessToken = await oauthService.getValidAccessToken(ctx.from.id);
        if (!accessToken) {
          await ctx.answerCallbackQuery({ text: 'Please connect Trakt first', show_alert: true });
          return;
        }
        try {
          const s = await traktService.getUserStats(accessToken);

          if (!s.available) {
            await ctx.reply(
              '⚠️ Trakt stats are unavailable right now.\n\n' +
                'This is a known issue on Trakt\'s side. Your numbers will return automatically.',
            );
            await ctx.answerCallbackQuery();
            return;
          }

          const { formatWatchTime } = await import('../utils/format');
          const lines = [
            '📊 *Your Trakt Stats*',
            '',
            `🎬 Movies watched: *${s.moviesWatched}*`,
            `📺 Episodes watched: *${s.episodesWatched}*`,
            `📼 Shows watched: *${s.showsWatched}*`,
            `🔁 Total plays: *${s.moviesWatched + s.episodesWatched}*`,
            `⭐ Ratings given: *${s.ratingsGiven}*`,
            '',
            `⏱ *Total time watched*`,
            `🎬 Movies: *${formatWatchTime(s.movieMinutes)}*`,
            `📺 Episodes: *${formatWatchTime(s.episodeMinutes)}*`,
            `📊 Total: *${formatWatchTime(s.totalMinutes)}*`,
          ];
          await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
          await ctx.answerCallbackQuery();
        } catch (err) {
          logger.error('stats error', err);
          await ctx.answerCallbackQuery({ text: 'Failed to load stats', show_alert: true });
        }
        return;
      }

      if (action === 'history') {
        const page = params.page ? Number(params.page) : 1;
        const type = params.type ?? '';
        const { renderHistory } = await import('../ui/screens/history');
        await renderHistory(ctx, traktService, oauthService, page, type);
        await ctx.answerCallbackQuery();
        return;
      }

      await ctx.answerCallbackQuery({ text: 'Action not implemented yet' });
    } catch (err) {
      logger.error('callback fallback error', err);
    }
  });
}